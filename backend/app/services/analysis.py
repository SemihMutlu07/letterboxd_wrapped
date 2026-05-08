from __future__ import annotations

import os
from collections import Counter
from datetime import datetime
from typing import Any, Dict, Optional

import aiohttp
import asyncio
import pandas as pd

from app import task_manager
from app.analysis_utils import compute_cinema_scale
from app.services.tmdb_client import (
    fetch_comprehensive_film_details,
    resolve_tmdb_id,
    tmdb_get,
)


async def process_comprehensive_letterboxd_data(
    session: aiohttp.ClientSession,
    csv_files: Dict[str, str],
    task_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Process Letterboxd data with concurrent TMDB enrichment."""

    def _progress(stage: str, message: str, progress: int = 0, total: int = 0) -> None:
        if task_id:
            task_manager.update_task_progress(task_id, stage, message, progress, total)
        else:
            print(f"📊 {stage}: {message} ({progress}/{total})")

    _progress("loading", "Loading CSV data files...", 0, 4)

    watched_df = pd.read_csv(csv_files["watched.csv"]) if "watched.csv" in csv_files else pd.DataFrame()
    ratings_df = pd.read_csv(csv_files["ratings.csv"]) if "ratings.csv" in csv_files else pd.DataFrame()
    diary_df = pd.read_csv(csv_files["diary.csv"]) if "diary.csv" in csv_files else pd.DataFrame()

    if watched_df.empty:
        raise ValueError("❌ watched.csv is required for analysis.")

    films_df = watched_df.rename(columns={"Name": "title", "Year": "year"})

    if not ratings_df.empty:
        ratings_df_renamed = ratings_df[["Name", "Year", "Rating"]].rename(
            columns={"Name": "title", "Year": "year", "Rating": "rating"}
        )
        films_df = pd.merge(films_df, ratings_df_renamed, on=["title", "year"], how="left")

    unique_films = films_df[["title", "year"]].drop_duplicates().reset_index(drop=True)
    _progress("processing", f"Found {len(unique_films)} unique films", 1, 3)

    _progress("tmdb_matching", "Matching films to TMDb (fast)...", 0, len(unique_films))
    resolve_tasks = [resolve_tmdb_id(session, row["title"], row["year"]) for _, row in unique_films.iterrows()]
    tmdb_ids = await asyncio.gather(*resolve_tasks)
    unique_films["tmdb_id"] = tmdb_ids
    match_rate = unique_films["tmdb_id"].notna().mean() * 100
    _progress("tmdb_matching", f"Matched {match_rate:.1f}% of films", len(unique_films), len(unique_films))

    unique_tmdb_ids = unique_films["tmdb_id"].dropna().unique()
    _progress("tmdb_metadata", "Gathering film metadata (fast)...", 0, len(unique_tmdb_ids))
    fetch_tasks = [fetch_comprehensive_film_details(session, tmdb_id) for tmdb_id in unique_tmdb_ids]
    metadata_results = await asyncio.gather(*fetch_tasks)
    metadata_df = pd.DataFrame([m for m in metadata_results if m])
    _progress("tmdb_metadata", "Metadata collection complete", len(unique_tmdb_ids), len(unique_tmdb_ids))

    films_enriched = pd.merge(unique_films, metadata_df, on="tmdb_id", how="left", suffixes=("_csv", "_tmdb"))

    if "title_tmdb" in films_enriched.columns:
        films_enriched["title"] = films_enriched["title_tmdb"].fillna(films_enriched["title_csv"])
    else:
        films_enriched["title"] = films_enriched["title_csv"]

    films_enriched.drop(
        columns=[col for col in ["title_csv", "title_tmdb"] if col in films_enriched.columns],
        inplace=True,
    )

    _progress("analyzing", "Generating comprehensive statistics...", 0, 10)

    stats: Dict[str, Any] = {}

    # === ENRICHED FILM DATA SUMMARY ===
    stats["enriched_films_summary"] = {
        "total_enriched": len(films_enriched[films_enriched["tmdb_id"].notna()]),
        "budget_data_available": len(films_enriched[films_enriched["budget"] > 0]),
        "revenue_data_available": len(films_enriched[films_enriched["revenue"] > 0]),
        "popularity_data_available": len(films_enriched[films_enriched["popularity"] > 0]),
        "keywords_data_available": len(films_enriched[films_enriched["keywords_full"].apply(lambda x: isinstance(x, list) and len(x) > 0)]),
        "countries_data_available": len(films_enriched[films_enriched["production_countries"].apply(lambda x: isinstance(x, list) and len(x) > 0)]),
    }

    total_films = len(films_enriched)
    stats["data_quality_report"] = {
        "total_films_analyzed": total_films,
        "tmdb_match_rate": round((len(films_enriched[films_enriched["tmdb_id"].notna()]) / total_films) * 100, 1) if total_films > 0 else 0,
        "budget_coverage": round((len(films_enriched[films_enriched["budget"] > 0]) / total_films) * 100, 1) if total_films > 0 else 0,
        "revenue_coverage": round((len(films_enriched[films_enriched["revenue"] > 0]) / total_films) * 100, 1) if total_films > 0 else 0,
        "popularity_coverage": round((len(films_enriched[films_enriched["popularity"] > 0]) / total_films) * 100, 1) if total_films > 0 else 0,
        "keywords_coverage": round((len(films_enriched[films_enriched["keywords_full"].apply(lambda x: isinstance(x, list) and len(x) > 0)]) / total_films) * 100, 1) if total_films > 0 else 0,
        "countries_coverage": round((len(films_enriched[films_enriched["production_countries"].apply(lambda x: isinstance(x, list) and len(x) > 0)]) / total_films) * 100, 1) if total_films > 0 else 0,
        "storytelling_readiness": (
            "excellent" if total_films > 0 and (len(films_enriched[films_enriched["tmdb_id"].notna()]) / total_films) > 0.8
            else "good" if total_films > 0 and (len(films_enriched[films_enriched["tmdb_id"].notna()]) / total_films) > 0.6
            else "limited"
        ),
    }

    if not films_enriched.empty:
        valid_budgets = films_enriched[films_enriched["budget"] > 0]["budget"]
        valid_revenues = films_enriched[films_enriched["revenue"] > 0]["revenue"]

        if not valid_budgets.empty:
            stats["budget_analytics"] = {
                "average_budget": float(valid_budgets.mean()),
                "median_budget": float(valid_budgets.median()),
                "total_budget_watched": float(valid_budgets.sum()),
                "highest_budget": float(valid_budgets.max()),
                "budget_range_preference": "high" if valid_budgets.median() > 50000000 else "medium" if valid_budgets.median() > 10000000 else "low",
            }

        if not valid_revenues.empty:
            stats["revenue_analytics"] = {
                "average_revenue": float(valid_revenues.mean()),
                "median_revenue": float(valid_revenues.median()),
                "total_revenue_watched": float(valid_revenues.sum()),
                "highest_revenue": float(valid_revenues.max()),
            }

        valid_popularity = films_enriched[films_enriched["popularity"] > 0]["popularity"]
        if not valid_popularity.empty:
            stats["popularity_analytics"] = {
                "average_popularity": float(valid_popularity.mean()),
                "median_popularity": float(valid_popularity.median()),
                "popularity_variance": float(valid_popularity.std()) if len(valid_popularity) > 1 else 0,
                "mainstream_percentage": float((valid_popularity > 20).mean() * 100),
                "niche_percentage": float((valid_popularity < 5).mean() * 100),
            }

        all_keywords = []
        for keywords_list in films_enriched["keywords_full"].dropna():
            if isinstance(keywords_list, list):
                all_keywords.extend([kw.get("name", "") for kw in keywords_list if isinstance(kw, dict)])

        if all_keywords:
            keyword_counts = Counter(all_keywords)
            stats["keywords_analytics"] = {
                "total_unique_keywords": len(keyword_counts),
                "top_keywords": [{"keyword": k, "count": v} for k, v in keyword_counts.most_common(20)],
                "keyword_diversity": len(keyword_counts) / len(all_keywords) if all_keywords else 0,
            }

        all_countries = []
        for countries_list in films_enriched["production_countries"].dropna():
            if isinstance(countries_list, list):
                all_countries.extend([c.get("name", "") for c in countries_list if isinstance(c, dict)])

        if all_countries:
            country_counts_adv = Counter(all_countries)
            stats["countries_analytics"] = {
                "total_countries_explored": len(country_counts_adv),
                "top_countries_detailed": [
                    {"country": country, "count": count, "percentage": (count / len(all_countries)) * 100}
                    for country, count in country_counts_adv.most_common(10)
                ],
                "geographic_diversity": len(country_counts_adv) / len(all_countries) if all_countries else 0,
                "international_percentage": float((1 - country_counts_adv.get("United States", 0) / len(all_countries)) * 100) if all_countries else 0,
            }

    # === BASIC STATS ===
    stats["total_films"] = len(films_df)
    stats["films_with_metadata"] = len(metadata_df)
    stats["metadata_coverage"] = round((len(metadata_df) / len(unique_films)) * 100, 1) if len(unique_films) > 0 else 0
    _progress("analyzing", "Basic stats complete", 1, 10)

    # === RATING ANALYSIS ===
    if "rating" in films_df.columns and films_df["rating"].notna().any():
        ratings = films_df["rating"].dropna()
        stats["average_rating"] = round(ratings.mean(), 2)
        stats["median_rating"] = round(ratings.median(), 1)
        stats["rating_distribution"] = ratings.value_counts().sort_index().to_dict()
        stats["total_rated_films"] = len(ratings)
        stats["most_common_rating"] = ratings.mode().iloc[0] if not ratings.mode().empty else None
    _progress("analyzing", "Rating analysis complete", 2, 10)

    # === RUNTIME ANALYSIS ===
    if "runtime" in films_enriched.columns and films_enriched["runtime"].notna().any():
        runtimes = films_enriched[films_enriched["runtime"] > 0]["runtime"].dropna()
        if not runtimes.empty:
            total_runtime = int(runtimes.sum())
            stats["total_runtime"] = total_runtime
            stats["hours_watched"] = round(total_runtime / 60, 1)
            stats["days_watched"] = round(total_runtime / (60 * 24), 1)
            stats["average_runtime"] = round(runtimes.mean(), 1)
            stats["median_runtime"] = round(runtimes.median(), 1)

            longest_film_data = films_enriched.loc[runtimes.idxmax()]
            shortest_film_data = films_enriched.loc[runtimes.idxmin()]

            stats["longest_film"] = {
                "title": longest_film_data["title"],
                "runtime": int(longest_film_data["runtime"]),
            }
            stats["shortest_film"] = {
                "title": shortest_film_data["title"],
                "runtime": int(shortest_film_data["runtime"]),
            }
    _progress("analyzing", "Runtime analysis complete", 3, 10)

    # === DATE ANALYSIS ===
    if not diary_df.empty:
        date_column = None
        for col in ["Watched Date", "Date", "Watch Date", "Watched", "Date Watched", "WatchedDate"]:
            if col in diary_df.columns:
                date_column = col
                break

        if date_column:
            diary_df["parsed_date"] = pd.to_datetime(diary_df[date_column], errors="coerce")
            valid_dates = diary_df.dropna(subset=["parsed_date"])
        else:
            valid_dates = pd.DataFrame()
    else:
        date_column = None
        valid_dates = pd.DataFrame()

    date_data = None
    date_source = "diary"

    if date_column and not valid_dates.empty and len(valid_dates) >= 5:
        date_data = valid_dates

    if date_data is None and not watched_df.empty:
        watched_date_col = None
        for col in ["Date", "Watched Date", "Watch Date"]:
            if col in watched_df.columns:
                watched_date_col = col
                break

        if watched_date_col:
            watched_df["parsed_date"] = pd.to_datetime(watched_df[watched_date_col], errors="coerce")
            watched_valid = watched_df.dropna(subset=["parsed_date"])
            if not watched_valid.empty:
                date_data = watched_valid
                date_source = "watched"

    if date_data is not None:
        date_data["year_month"] = date_data["parsed_date"].dt.strftime("%Y-%m")
        monthly_counts = date_data["year_month"].value_counts().sort_index()
        stats["monthly_viewing_habits"] = [
            {"month": ym, "count": int(cnt)} for ym, cnt in monthly_counts.items()
        ]

        date_data["day_of_week"] = date_data["parsed_date"].dt.dayofweek
        stats["day_of_week_pattern"] = {
            "weekday": len(date_data[date_data["day_of_week"] < 5]),
            "weekend": len(date_data[date_data["day_of_week"] >= 5]),
        }

        earliest_date = date_data["parsed_date"].min()
        latest_date = date_data["parsed_date"].max()
        total_days = (latest_date - earliest_date).days

        if total_days == 0:
            total_days = 1
        elif total_days < 30:
            total_days = max(total_days, 7)

        if total_days == 1:
            period_description = f"Analyzing your cinematic moment on {earliest_date.strftime('%B %d, %Y')}"
        elif total_days <= 365:
            period_description = f"Analyzing your last {total_days} days of cinematic history"
        elif total_days <= 730:
            period_description = f"Exploring {total_days} days of your film journey"
        else:
            years = total_days // 365
            period_description = f"Journeying through {years} years of your cinematic legacy"

        stats["data_timeline"] = {
            "earliest_date": earliest_date.isoformat(),
            "latest_date": latest_date.isoformat(),
            "total_days": total_days,
            "period_description": period_description,
        }

    # === ADVANCED ANALYTICS — CINEMATIC PERSONA ===
    top_genre = stats["top_genres"][0]["name"] if stats.get("top_genres") else "Film"
    top_decade = stats["favorite_decade"]["name"] if stats.get("favorite_decade") else "2020s"
    top_country = stats["top_countries"][0]["name"] if stats.get("top_countries") else "USA"

    if top_genre in ("Unknown", ""):
        top_genre = "Genre-Defying"
    if top_decade in ("Unknown", ""):
        top_decade = "Timeless"
    if top_country in ("Unknown", ""):
        top_country = "International"

    persona_map = {
        ("Action", "2020s", "USA"): ("Blockbuster Addict", "You live for explosions, CGI, and popcorn entertainment."),
        ("Drama", "1970s", "USA"): ("Classic Hollywood Connoisseur", "You appreciate the golden age when movies had substance."),
        ("Horror", "1980s", "USA"): ("Retro Horror Fiend", "You know true terror peaked in the 80s."),
        ("Comedy", "2000s", "USA"): ("Millennial Comedy Scholar", "You quote movies more than you quote real people."),
        ("Sci-Fi", "1980s", "USA"): ("Cyberpunk Prophet", "You saw the future coming before everyone else."),
        ("Crime", "1990s", "USA"): ("Tarantino Disciple", "You believe violence can be art when done right."),
        ("Romance", "1950s", "USA"): ("Old Hollywood Romantic", "You think love stories peaked before color TV."),
        ("Thriller", "2010s", "USA"): ("Modern Suspense Seeker", "You need your movies to keep you guessing."),
        ("Animation", "2000s", "Japan"): ("Anime Connoisseur", "You know Miyazaki is basically cinema Jesus."),
        ("Documentary", "2010s", "USA"): ("Reality Obsessive", "Fiction is for people who can't handle the truth."),
    }

    persona_key = (top_genre, top_decade, top_country)
    if persona_key in persona_map:
        persona, description = persona_map[persona_key]
    else:
        if "Horror" in top_genre:
            persona, description = "Horror Devotee", "You watch scary movies like other people watch comfort food shows."
        elif "Comedy" in top_genre:
            persona, description = "Laugh Track Survivor", "You've seen every joke coming since 1995, but you still show up."
        elif "Drama" in top_genre:
            persona, description = "Emotional Masochist", "You pay money to feel feelings. That's commitment."
        elif "Action" in top_genre:
            persona, description = "Adrenaline Junkie", "Physics are optional, explosions are mandatory."
        elif "Sci-Fi" in top_genre:
            persona, description = "Future Pessimist", "You watch dystopian futures and think 'sounds about right.'"
        else:
            persona = f"{top_genre} Enthusiast"
            description = f"You've made {top_genre} your personality, and honestly? Respect."

    stats["cinematic_persona"] = {"persona": persona, "description": description}

    # === DIRECTOR DEEP ANALYSIS ===
    if stats.get("most_watched_director") and not films_enriched.empty:
        director_name = stats["most_watched_director"]["name"]
        director_films = films_enriched[films_enriched["director"] == director_name]

        if not director_films.empty and "rating" in films_df.columns:
            director_with_ratings = pd.merge(
                director_films, films_df[["title", "year", "rating"]], on=["title", "year"], how="left"
            )
            director_ratings = director_with_ratings["rating"].dropna()

            if not director_ratings.empty:
                avg_rating = round(director_ratings.mean(), 2)
                stats["director_deep_analysis"] = {
                    "director_name": director_name,
                    "average_rating_given": avg_rating,
                    "total_films": len(director_films),
                    "relationship": "critical" if avg_rating < 3.5 else "generous" if avg_rating > 4.0 else "balanced",
                }

    # === ACTOR/ACTRESS ANALYSIS ===
    if not films_enriched.empty and "cast" in films_enriched.columns:
        all_actors = []
        for cast_list in films_enriched["cast"].dropna():
            if isinstance(cast_list, list) and len(cast_list) > 0:
                all_actors.append(cast_list[0])

        if all_actors:
            actor_counts = Counter(all_actors)
            top_actor = actor_counts.most_common(1)[0]
            stats["my_star"] = {"name": top_actor[0], "count": top_actor[1]}

    # === POPULARITY INFO ===
    if not films_enriched.empty and "popularity" in films_enriched.columns:
        popularity_scores = films_enriched["popularity"].dropna()
        if not popularity_scores.empty:
            avg_popularity = float(popularity_scores.mean())
            stats["popularity_info"] = {
                "average": round(avg_popularity, 1),
                "mainstream_pct": round(float((popularity_scores > 20).mean() * 100), 1),
                "niche_pct": round(float((popularity_scores < 5).mean() * 100), 1),
            }

    # === FUN STATISTICS ===
    fun_stats: Dict[str, Any] = {}

    if not films_enriched.empty:
        if "budget" in films_enriched.columns:
            max_budget_film = films_enriched.loc[films_enriched["budget"].idxmax()]
            if pd.notna(max_budget_film["budget"]) and max_budget_film["budget"] > 0:
                fun_stats["highest_budget_film"] = {
                    "title": max_budget_film["title"],
                    "budget": int(max_budget_film["budget"]),
                }

        if "revenue" in films_enriched.columns:
            max_revenue_film = films_enriched.loc[films_enriched["revenue"].idxmax()]
            if pd.notna(max_revenue_film["revenue"]) and max_revenue_film["revenue"] > 0:
                fun_stats["highest_grossing_film"] = {
                    "title": max_revenue_film["title"],
                    "revenue": int(max_revenue_film["revenue"]),
                }

        if "vote_average" in films_enriched.columns and "rating" in films_df.columns:
            enriched_with_ratings = pd.merge(
                films_enriched, films_df[["title", "year", "rating"]], on=["title", "year"], how="left"
            )
            guilty_candidates = enriched_with_ratings[
                (enriched_with_ratings["vote_average"] < 6.0) & (enriched_with_ratings["rating"] >= 4.0)
            ]
            if not guilty_candidates.empty:
                guilty_pleasure = guilty_candidates.loc[guilty_candidates["vote_average"].idxmin()]
                fun_stats["guilty_pleasure"] = {
                    "title": guilty_pleasure["title"],
                    "tmdb_rating": round(guilty_pleasure["vote_average"], 1),
                    "your_rating": guilty_pleasure["rating"],
                }

        if "genres" in films_enriched.columns:
            genre_combinations = []
            for genres in films_enriched["genres"].dropna():
                if isinstance(genres, list) and len(genres) >= 2:
                    genre_combinations.append(f"{genres[0]}-{genres[1]}")

            if genre_combinations:
                combo_counts = Counter(genre_combinations)
                top_combo = combo_counts.most_common(1)[0]
                fun_stats["favorite_genre_combo"] = {
                    "combination": top_combo[0],
                    "count": top_combo[1],
                }

    if stats.get("top_countries"):
        country_flags = {
            "United States": "🇺🇸", "France": "🇫🇷", "United Kingdom": "🇬🇧",
            "Japan": "🇯🇵", "Italy": "🇮🇹", "Germany": "🇩🇪", "South Korea": "🇰🇷",
            "Spain": "🇪🇸", "Canada": "🇨🇦", "India": "🇮🇳", "China": "🇨🇳",
            "Australia": "🇦🇺", "Russia": "🇷🇺", "Brazil": "🇧🇷", "Mexico": "🇲🇽",
        }
        fun_stats["world_tour"] = [
            {"country": c["name"], "flag": country_flags.get(c["name"], "🎬"), "count": c["count"]}
            for c in stats["top_countries"][:5]
        ]

    if not films_enriched.empty and "release_date" in films_enriched.columns:
        current_year = datetime.now().year
        film_ages = []
        for release_date in films_enriched["release_date"].dropna():
            if release_date:
                try:
                    film_ages.append(current_year - int(release_date[:4]))
                except Exception:
                    continue

        if film_ages:
            avg_age = round(sum(film_ages) / len(film_ages), 1)
            recent_films = len([age for age in film_ages if age <= 5])
            recent_percentage = round((recent_films / len(film_ages)) * 100, 1)
            fun_stats["film_age_analysis"] = {
                "average_age": avg_age,
                "recent_percentage": recent_percentage,
                "type": "innovation hunter" if recent_percentage > 60 else "classic lover" if avg_age > 20 else "balanced",
            }

    stats["fun_statistics"] = fun_stats

    # === STORY-DRIVEN ANALYTICS ===
    story_analytics: Dict[str, Any] = {}

    if stats.get("days_watched", 0) > 0:
        days = stats["days_watched"]
        if days >= 30:
            time_story = f"You spent {days:.0f} days watching movies this year. That's basically {days/30:.1f} months of your life. No regrets?"
        elif days >= 7:
            weeks = days / 7
            time_story = f"You clocked {days:.1f} days of screen time. That's {weeks:.1f} weeks of pure cinema dedication."
        else:
            time_story = f"You spent {days:.1f} days watching movies. Quality over quantity, we respect that."
        story_analytics["time_spent_story"] = time_story

    if not diary_df.empty and "parsed_date" in diary_df.columns:
        daily_counts = diary_df.groupby(diary_df["parsed_date"].dt.date).size()
        if not daily_counts.empty:
            most_active_date = daily_counts.idxmax()
            max_films = daily_counts.max()
            months_en = {
                1: "January", 2: "February", 3: "March", 4: "April", 5: "May", 6: "June",
                7: "July", 8: "August", 9: "September", 10: "October", 11: "November", 12: "December",
            }
            date_str = f"{months_en[most_active_date.month]} {most_active_date.day}"
            if max_films >= 4:
                activity_story = f"Remember {date_str}? You watched {max_films} movies in one day. That's either dedication or avoidance behavior."
            elif max_films == 3:
                activity_story = f"On {date_str}, you managed {max_films} films. Solid marathon vibes."
            else:
                activity_story = f"Your most active day was {date_str} with {max_films} films. Respectable commitment."
            story_analytics["most_active_day"] = {
                "date": date_str,
                "films": int(max_films),
                "story": activity_story,
            }

    # Rating personality
    if "rating" in films_df.columns:
        ratings = films_df["rating"].dropna()
        if not ratings.empty:
            avg_rating = ratings.mean()
            rating_std = ratings.std() if len(ratings) > 1 else 0
            if avg_rating >= 4.2:
                rating_personality = "Easy to Please"
                rating_description = "You hand out 4-5 stars like candy. Either you have great taste or low standards."
            elif avg_rating <= 3.2:
                rating_personality = "Tough Critic"
                rating_description = "Your ratings hover around 3 stars. You're basically the Gordon Ramsay of cinema."
            elif rating_std > 1.2:
                rating_personality = "Mood Swinger"
                rating_description = "Your ratings are all over the place. A film either destroys you or bores you to death."
            else:
                rating_personality = "Balanced Judge"
                rating_description = "Your ratings are perfectly balanced. You give every film exactly what it deserves."
            story_analytics["rating_personality"] = {
                "type": rating_personality,
                "description": rating_description,
                "average": round(avg_rating, 1),
            }

    stats["rating_personality"] = None
    if "rating" in films_df.columns:
        ratings = films_df["rating"].dropna()
        if not ratings.empty:
            avg_rating = ratings.mean()
            std_dev = ratings.std()
            if avg_rating > 4.0:
                stats["rating_personality"] = "The Generous Critic"
            elif avg_rating < 3.0:
                stats["rating_personality"] = "The Picky Gourmet"
            elif std_dev > 1.2:
                stats["rating_personality"] = "The All-or-Nothing Judge"
            else:
                stats["rating_personality"] = "The Balanced Reviewer"

    # Signature duo (director + actor combo)
    if not films_enriched.empty and "director" in films_enriched.columns and "cast" in films_enriched.columns:
        director_actor_combos = []
        for _, film in films_enriched.iterrows():
            if pd.notna(film["director"]) and isinstance(film.get("cast"), list) and len(film["cast"]) > 0:
                director = film["director"]
                main_actor = next((a for a in film["cast"] if a != director), None)
                if main_actor:
                    director_actor_combos.append({
                        "combo": f"{director}#{main_actor}",
                        "director": director,
                        "actor": main_actor,
                        "film": film["title"],
                    })

        if director_actor_combos:
            combo_counts = Counter([c["combo"] for c in director_actor_combos])
            top_combo = combo_counts.most_common(1)[0]
            combo_info = next((c for c in director_actor_combos if c["combo"] == top_combo[0]), None)
            if combo_info:
                if top_combo[1] >= 3:
                    combo_story = f"You've got a serious thing for {combo_info['director']} directing {combo_info['actor']}. {top_combo[1]} films together? That's not coincidence, that's obsession."
                elif top_combo[1] == 2:
                    combo_story = f"{combo_info['director']} + {combo_info['actor']} = your comfort zone. {top_combo[1]} films prove it."
                else:
                    combo_story = f"Your go-to combo: {combo_info['director']} directing {combo_info['actor']}."
                story_analytics["signature_duo"] = {
                    "director": combo_info["director"],
                    "actor": combo_info["actor"],
                    "count": top_combo[1],
                    "story": combo_story,
                }

    # Viewing season
    if stats.get("monthly_viewing_habits"):
        seasons = {
            "Winter": ["December", "January", "February"],
            "Spring": ["March", "April", "May"],
            "Summer": ["June", "July", "August"],
            "Fall": ["September", "October", "November"],
        }
        season_counts = {}
        for season, months in seasons.items():
            season_counts[season] = sum(
                m["count"] for m in stats["monthly_viewing_habits"] if m["month"] in months
            )

        if sum(season_counts.values()) > 0:
            top_season = max(season_counts, key=season_counts.get)
            total_seasons = sum(season_counts.values())
            season_percentage = round((season_counts[top_season] / total_seasons) * 100)
            season_stories = {
                "Winter": f"Winter is your movie season. You watched {season_percentage}% of your films during the cold months. Peak cozy behavior.",
                "Summer": f"Summer is when you really commit to cinema. {season_percentage}% of your films happened in the sunny months. Air conditioning is underrated.",
                "Spring": f"Spring awakens your cinematic spirit. {season_percentage}% of your films bloomed with the flowers. Very poetic of you.",
                "Fall": f"Fall is your movie season. {season_percentage}% of your films dropped with the leaves. Maximum atmospheric vibes.",
            }
            story_analytics["viewing_season"] = {
                "season": top_season,
                "percentage": season_percentage,
                "story": season_stories.get(top_season, f"{top_season} is your movie season!"),
            }

    # Cinematic passport
    if stats.get("top_countries") and stats.get("total_countries", 0) > 0:
        total_countries = stats["total_countries"]
        if total_countries >= 15:
            passport_story = f"You've collected {total_countries} countries in your cinematic passport this year. Basically a cultural anthropologist."
        elif total_countries >= 8:
            passport_story = f"You added {total_countries} new countries to your cinematic journey this year. Solid exploration game."
        else:
            passport_story = f"You discovered {total_countries} different countries through cinema this year. Quality over quantity."

        total_directors = stats.get("total_directors", 0)
        if total_directors >= 50:
            director_story = f"You explored {total_directors} directors this year. You're basically a walking IMDb."
        elif total_directors >= 20:
            director_story = f"You discovered {total_directors} new directors, expanding your cinematic horizons like a proper film scholar."
        else:
            director_story = f"You explored {total_directors} different directors this year. Building that auteur knowledge base."

        story_analytics["cinematic_passport"] = {
            "countries": total_countries,
            "directors": total_directors,
            "country_story": passport_story,
            "director_story": director_story,
        }

    # Cinema archetype
    avg_popularity_val = 0.0
    if not films_enriched.empty and "popularity" in films_enriched.columns:
        pop_scores = films_enriched["popularity"].dropna()
        if not pop_scores.empty:
            avg_popularity_val = pop_scores.mean()

    avg_film_age_val = 20.0
    if stats.get("fun_statistics", {}).get("film_age_analysis"):
        avg_film_age_val = stats["fun_statistics"]["film_age_analysis"]["average_age"]

    is_mainstream = avg_popularity_val > 30
    is_modern = avg_film_age_val < 15

    if is_mainstream and is_modern:
        archetype = "Pop Culture Professor"
        archetype_description = "You follow current and popular films religiously. You're basically the pulse of contemporary cinema."
    elif not is_mainstream and not is_modern:
        archetype = "Archive Treasure Hunter"
        archetype_description = "You dig up old and obscure films like a true cinephile. You're the keeper of forgotten classics."
    elif not is_mainstream and is_modern:
        archetype = "Indie Oracle"
        archetype_description = "You discover new independent and festival films before everyone else. You're a cinema prophet."
    else:
        archetype = "Time Traveler"
        archetype_description = "You watch films from every era with perfect balance. You're the master of cinema history."

    story_analytics["cinema_archetype"] = {
        "type": archetype,
        "description": archetype_description,
        "popularity_score": round(avg_popularity_val, 1),
        "film_age": round(avg_film_age_val, 1),
    }

    stats["story_analytics"] = story_analytics

    # === DETAILED ANALYSIS ===
    director_counts = Counter(films_enriched["director"].dropna())
    stats["top_directors"] = [{"name": n, "count": c} for n, c in director_counts.most_common(20)]
    stats["total_directors"] = len(director_counts)
    if director_counts:
        n, c = director_counts.most_common(1)[0]
        stats["most_watched_director"] = {"name": n, "count": c}
    else:
        stats["most_watched_director"] = None
    _progress("analyzing", "Director analysis complete", 4, 10)

    genre_counts = Counter([g for genres in films_enriched["genres"].dropna() for g in genres])
    stats["top_genres"] = [{"name": n, "count": c} for n, c in genre_counts.most_common(15)]
    if genre_counts:
        n, c = genre_counts.most_common(1)[0]
        stats["favorite_genre"] = {"name": n, "count": c}
    else:
        stats["favorite_genre"] = None
    _progress("analyzing", "Genre analysis complete", 5, 10)

    decade_counts = Counter(films_enriched["decade"].dropna())
    stats["decades"] = [
        {"decade": d, "count": c}
        for d, c in sorted(decade_counts.items(), key=lambda x: int(x[0].replace("s", "")) if x[0] and x[0] != "Unknown" else 0)
    ]
    if decade_counts:
        n, c = decade_counts.most_common(1)[0]
        stats["favorite_decade"] = {"name": n, "count": c}
    else:
        stats["favorite_decade"] = None
    _progress("analyzing", "Decade analysis complete", 6, 10)

    country_counts = Counter([c for countries in films_enriched["countries"].dropna() for c in countries])
    stats["top_countries"] = [{"name": n, "count": c} for n, c in country_counts.most_common(15)]
    stats["total_countries"] = len(country_counts)
    _progress("analyzing", "Country analysis complete", 7, 10)

    language_counts = Counter(films_enriched["language"].dropna())
    stats["top_languages"] = [{"language": lang, "count": cnt} for lang, cnt in language_counts.most_common(10)]
    _progress("analyzing", "Language analysis complete", 8, 10)

    # === Cinema Scale v2 ===
    median_release_year = None
    if "release_date" in films_enriched.columns:
        release_years = (
            films_enriched["release_date"]
            .dropna()
            .apply(lambda d: int(str(d)[:4]) if d and len(str(d)) >= 4 else None)
            .dropna()
        )
        if not release_years.empty:
            median_release_year = int(release_years.median())

    stats["sinefil_meter"] = compute_cinema_scale(
        country_counts=country_counts,
        decade_counts=decade_counts,
        language_counts=language_counts,
        genre_counts=genre_counts,
        director_counts=director_counts,
        total_films=len(films_enriched),
        median_release_year=median_release_year,
    )

    if os.getenv("DEBUG_CINEMA_SCALE"):
        print(f"🎬 Cinema Scale: score={stats['sinefil_meter']['score']}, breakdown={stats['sinefil_meter']['breakdown']}")

    # === TOP ACTORS with profiles ===
    cast_counts = Counter([actor for cast_list in films_enriched["cast"].dropna() for actor in cast_list])

    top_actors_with_profiles = []
    for name, count in cast_counts.most_common(3):
        profile_path = None
        try:
            person_data = await tmdb_get(session, "search/person", {"query": name})
            if person_data and person_data.get("results"):
                profile_path = person_data["results"][0].get("profile_path")
        except Exception:
            pass
        top_actors_with_profiles.append({"name": name, "count": count, "profile_path": profile_path})

    remaining_actors = [{"name": n, "count": c} for n, c in cast_counts.most_common(20)[3:]]
    stats["top_actors"] = top_actors_with_profiles + remaining_actors
    _progress("analyzing", "Cast analysis complete", 9, 10)

    # === TEST LAB DATASETS ===
    # These fields power the optional results Test Lab sections. They are derived
    # from already-enriched rows so the stable wrapped view remains unchanged.
    analysis_df = pd.merge(
        films_enriched,
        films_df[["title", "year", "rating"]] if "rating" in films_df.columns else films_df[["title", "year"]],
        on=["title", "year"],
        how="left",
    )

    def _clean_year(value: Any) -> Optional[int]:
        try:
            if pd.isna(value):
                return None
            return int(value)
        except Exception:
            return None

    def _clean_rating(value: Any) -> Optional[float]:
        try:
            if pd.isna(value):
                return None
            return float(value)
        except Exception:
            return None

    def _rated_entity_rows(
        entity_column: str,
        count_source: Counter,
        min_rated: int = 3,
    ) -> list[dict]:
        rows: list[dict] = []
        if entity_column not in analysis_df.columns or "rating" not in analysis_df.columns:
            return rows
        for name, count in count_source.items():
            rated = analysis_df[
                (analysis_df[entity_column] == name) & analysis_df["rating"].notna()
            ]["rating"]
            if len(rated) >= min_rated:
                rows.append({
                    "name": name,
                    "count": int(count),
                    "avg_rating": round(float(rated.mean()), 2),
                    "rated_count": int(len(rated)),
                })
        return sorted(rows, key=lambda row: (row["avg_rating"], row["rated_count"]), reverse=True)

    if "rating" in analysis_df.columns:
        rated_rows = analysis_df[analysis_df["rating"].notna()]
        stats["rated_films"] = [
            {
                "title": str(row.get("title") or ""),
                "year": _clean_year(row.get("year")),
                "rating": float(row.get("rating")),
                "poster_path": row.get("poster_path") if isinstance(row.get("poster_path"), str) else "",
            }
            for _, row in rated_rows.sort_values("rating", ascending=False).iterrows()
        ]
    else:
        rated_rows = pd.DataFrame()
        stats["rated_films"] = []

    stats["all_films"] = [
        {
            "title": str(row.get("title") or ""),
            "year": _clean_year(row.get("year")),
            "director": row.get("director") if pd.notna(row.get("director")) else None,
            "genres": row.get("genres") if isinstance(row.get("genres"), list) else [],
            "countries": row.get("countries") if isinstance(row.get("countries"), list) else [],
            "language": row.get("language") if pd.notna(row.get("language")) else None,
            "runtime": _clean_year(row.get("runtime")),
            "poster_path": row.get("poster_path") if isinstance(row.get("poster_path"), str) else "",
            "decade": row.get("decade") if pd.notna(row.get("decade")) else None,
            "rating": _clean_rating(row.get("rating")) if "rating" in analysis_df.columns else None,
        }
        for _, row in analysis_df.iterrows()
    ]

    stats["directors_with_ratings"] = _rated_entity_rows("director", director_counts, min_rated=3)

    actor_rated: dict[str, list[float]] = {}
    if "cast" in analysis_df.columns and "rating" in analysis_df.columns:
        for _, row in analysis_df.iterrows():
            rating = _clean_rating(row.get("rating"))
            cast = row.get("cast")
            if rating is None or not isinstance(cast, list):
                continue
            for actor in cast:
                actor_rated.setdefault(actor, []).append(rating)

    actor_profile_map = {a["name"]: a.get("profile_path") for a in top_actors_with_profiles}
    stats["actors_with_ratings"] = sorted(
        [
            {
                "name": actor,
                "count": int(cast_counts.get(actor, 0)),
                "avg_rating": round(float(sum(ratings) / len(ratings)), 2),
                "rated_count": len(ratings),
                "profile_path": actor_profile_map.get(actor),
            }
            for actor, ratings in actor_rated.items()
            if len(ratings) >= 3
        ],
        key=lambda row: (row["avg_rating"], row["rated_count"]),
        reverse=True,
    )

    country_iso_counts: Counter = Counter()
    country_iso_names: dict[str, str] = {}
    country_iso_ratings: dict[str, list[float]] = {}
    country_name_ratings: dict[str, list[float]] = {}

    if "production_countries" in analysis_df.columns:
        for _, row in analysis_df.iterrows():
            rating = _clean_rating(row.get("rating")) if "rating" in analysis_df.columns else None
            production_countries = row.get("production_countries")
            if not isinstance(production_countries, list):
                continue
            for country in production_countries:
                if not isinstance(country, dict):
                    continue
                iso2 = country.get("iso_3166_1")
                name = country.get("name")
                if name:
                    country_name_ratings.setdefault(name, [])
                    if rating is not None:
                        country_name_ratings[name].append(rating)
                if not iso2 or not name:
                    continue
                country_iso_counts[iso2] += 1
                country_iso_names[iso2] = name
                if rating is not None:
                    country_iso_ratings.setdefault(iso2, []).append(rating)

    stats["countries_iso_data"] = []
    for iso2, count in country_iso_counts.most_common():
        ratings = country_iso_ratings.get(iso2, [])
        item = {
            "iso2": iso2,
            "name": country_iso_names.get(iso2, iso2),
            "count": int(count),
        }
        if len(ratings) >= 5:
            item["avg_rating"] = round(float(sum(ratings) / len(ratings)), 2)
            item["rated_count"] = len(ratings)
        stats["countries_iso_data"].append(item)

    stats["countries_with_ratings"] = sorted(
        [
            {
                "name": name,
                "count": int(country_counts.get(name, 0)),
                "avg_rating": round(float(sum(ratings) / len(ratings)), 2),
                "rated_count": len(ratings),
            }
            for name, ratings in country_name_ratings.items()
            if len(ratings) >= 5
        ],
        key=lambda row: (row["avg_rating"], row["rated_count"]),
        reverse=True,
    )

    # === MOVIE CRUSH ===
    stats["movie_crush"] = None
    if top_actors_with_profiles:
        top = top_actors_with_profiles[0]
        stats["movie_crush"] = {
            "name": top["name"],
            "profile_path": top["profile_path"],
            "count": top["count"],
        }

    # === INSIGHTS ===
    insights = []
    if stats.get("days_watched", 0) > 0:
        insights.append({"title": "Time Invested", "description": f"You've spent {stats['days_watched']} days of your life watching movies!"})
    if stats.get("most_watched_director"):
        insights.append({"title": "Director Obsession", "description": f"You're a big fan of {stats['most_watched_director']['name']} - you've watched {stats['most_watched_director']['count']} of their films!"})
    if stats.get("favorite_decade"):
        insights.append({"title": "Time Traveler", "description": f"You love {stats['favorite_decade']['name']} cinema with {stats['favorite_decade']['count']} films from that era!"})
    if stats.get("average_rating", 0) > 4:
        insights.append({"title": "Easy to Please", "description": f"You're generous with ratings - averaging {stats['average_rating']}★!"})
    elif stats.get("average_rating", 0) < 3:
        insights.append({"title": "Tough Critic", "description": f"You're a tough critic with an average rating of {stats['average_rating']}★"})
    if stats.get("total_countries", 0) > 10:
        insights.append({"title": "Global Cinema Explorer", "description": f"You've watched films from {stats['total_countries']} different countries!"})
    stats["insights"] = insights

    # === FINAL WRAP-UP ===
    stats["analysis_date"] = datetime.now().isoformat()

    stats["secret_obsession"] = None
    if "keywords_analytics" in stats and "top_keywords" in stats["keywords_analytics"]:
        genre_names = {g["name"].lower() for g in stats.get("top_genres", [])}
        for kw in stats["keywords_analytics"]["top_keywords"]:
            if kw["keyword"].lower() not in genre_names:
                stats["secret_obsession"] = kw["keyword"]
                break

    stats["runtime_persona"] = "The Balanced Viewer"
    if "average_runtime" in stats:
        if stats["average_runtime"] > 130:
            stats["runtime_persona"] = "The Marathoner"
        elif stats["average_runtime"] < 100:
            stats["runtime_persona"] = "The Sprinter"

    stats["furthest_destination"] = None
    if "top_countries" in stats:
        for country in stats["top_countries"]:
            if country["name"] not in ("USA", "UK"):
                stats["furthest_destination"] = country["name"]
                break

    _progress("analyzing", "Analysis complete!", 10, 10)
    return stats
