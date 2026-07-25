import type {
  PersonFilm,
  StatsData,
} from "@/containers/results/sections/types";

export type ResultFilm = NonNullable<StatsData["all_films"]>[number];

const toPersonFilm = (film: ResultFilm): PersonFilm => ({
  title: film.title,
  year: film.year ? String(film.year) : undefined,
  poster_path: film.poster_path,
  user_rating: film.rating ?? null,
});

const byRatingYearTitle = (a: PersonFilm, b: PersonFilm) => {
  const ratingDiff = (b.user_rating ?? -1) - (a.user_rating ?? -1);
  if (ratingDiff !== 0) return ratingDiff;
  const yearDiff = Number(b.year ?? 0) - Number(a.year ?? 0);
  return yearDiff || a.title.localeCompare(b.title);
};

export const selectAllFilms = (films: ResultFilm[]) =>
  films.map(toPersonFilm).sort(byRatingYearTitle);

export const selectPersonFilms = (
  films: ResultFilm[],
  name: string,
  isDirector: boolean,
) =>
  films
    .filter((film) =>
      isDirector
        ? film.director?.toLowerCase() === name.toLowerCase()
        : film.cast?.some(
            (actor) => actor.toLowerCase() === name.toLowerCase(),
          ),
    )
    .map(toPersonFilm);

export const selectRatedFilms = (films: ResultFilm[]) =>
  films
    .filter((film) => film.rating != null)
    .map(toPersonFilm)
    .sort(byRatingYearTitle);

export const selectGenreFilms = (films: ResultFilm[], genre: string) =>
  films
    .filter((film) => film.genres?.includes(genre))
    .map(toPersonFilm)
    .sort(byRatingYearTitle);

export const selectDirectorFilms = (films: ResultFilm[], director: string) =>
  films
    .filter((film) => film.director?.toLowerCase() === director.toLowerCase())
    .map(toPersonFilm);
