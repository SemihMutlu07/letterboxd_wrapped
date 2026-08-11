'use client';

import type { StatsData } from '@/containers/results/sections/types';
import { reviewCharLength, reviewWordCount } from '@/lib/reviews';

import type { Slide } from '../types';
import {
  allPosterMedia,
  compactMedia,
  filmByTitle,
  genrePosters,
  generousCriticPosters,
  personFilmPosters,
  posterMedia,
  profileMedia,
  storySeason,
  activeDayCopy,
  topRatedPosters,
} from '../media';
import { Big, Label, Sub } from '../SlideTypography';

export function buildSlides(stats: StatsData, locale: 'en' | 'tr' = 'en'): Slide[] {
  const tr = locale === 'tr';
  const copy = (en: string, turkish: string) => tr ? turkish : en;
  const slides: Slide[] = [];
  const username = stats.scraped_username;
  const broadPosters = topRatedPosters(stats, 10);
  const directorName = stats.most_watched_director?.name ?? stats.top_directors?.[0]?.name;
  const topActor = stats.top_actors?.[0];
  const viewingSeason = storySeason(stats.story_analytics?.viewing_season);
  const mostActiveDay = activeDayCopy(stats.story_analytics?.most_active_day);

  slides.push({
    key: 'intro',
    media: broadPosters,
    accent: '#f59e0b',
    visual: 'mosaic',
    body: (
      <>
        <Label>Movies Wrapped</Label>
        <Big>{username ? `@${username}` : copy('Your year in film', 'Film yılın')}</Big>
        {stats.data_timeline?.period_description && <Sub>{stats.data_timeline.period_description}</Sub>}
        <Sub className="mt-6">
          {copy('They say the movies you choose say more about you than the ones you skip. Let’s find out what yours are saying.', 'Seçtiğin filmlerin, es geçtiklerinden daha çok şey anlattığı söylenir. Bakalım seninkiler ne diyor.')}
        </Sub>
      </>
    ),
  });

  if (stats.total_films) {
    const d = stats.days_watched;
    const fastForwardPosters = allPosterMedia(stats);
    slides.push({
      key: 'volume',
      media: compactMedia([
        posterMedia(stats.longest_film ? filmByTitle(stats, stats.longest_film.title) : null),
        ...fastForwardPosters,
        ...broadPosters,
      ], Math.max(24, fastForwardPosters.length)),
      accent: '#f97316',
      visual: 'cascade',
      body: (
        <>
          <Label>{copy('Fast forward', 'Hızlı ileri')}</Label>
          <Big>{stats.total_films} {copy('films', 'film')}</Big>
          {d || stats.hours_watched ? (
            <Sub>
              {d
                ? copy(`${d} days of your life, in the dark, watching other people live.`, `Hayatının ${d} günü karanlıkta, başka insanların hayatını izleyerek geçti.`)
                : stats.hours_watched
                  ? copy(`${Math.round(stats.hours_watched)} hours. That’s not a hobby, that’s a parallel life.`, `${Math.round(stats.hours_watched)} saat. Bu hobi değil, paralel bir hayat.`)
                  : null}
            </Sub>
          ) : null}
        </>
      ),
    });
  }

  const peakMonth = (stats.monthly_viewing_habits ?? []).reduce<{ month: string; count: number } | null>(
    (best, m) => (!best || m.count > best.count ? m : best),
    null,
  );
  if (peakMonth || viewingSeason) {
    slides.push({
      key: 'rhythm',
      media: broadPosters.slice(1, 9),
      accent: '#22c55e',
      visual: 'mosaic',
      body: (
        <>
          <Label>{copy('Your rhythm', 'Ritmin')}</Label>
          <Big>{peakMonth ? peakMonth.month : viewingSeason}</Big>
          <Sub>
            {peakMonth
              ? copy(`${peakMonth.count} films that month — you weren’t watching, you were processing something.`, `O ay ${peakMonth.count} film — izlemiyordun, bir şeyleri işliyordun.`)
              : null}
            {mostActiveDay
              ? ` ${mostActiveDay}`
              : ''}
          </Sub>
        </>
      ),
    });
  }

  if (stats.favorite_genre?.name) {
    slides.push({
      key: 'genre',
      media: genrePosters(stats, stats.favorite_genre.name, 8),
      accent: '#38bdf8',
      visual: 'mosaic',
      body: (
        <>
          <Label>{copy('Where you kept returning', 'Dönüp dolaşıp geldiğin yer')}</Label>
          <Big>{stats.favorite_genre.name}</Big>
          <Sub>{copy(`${stats.favorite_genre.count} times. Not a phase, apparently — some places just feel like home.`, `${stats.favorite_genre.count} kez. Görünen o ki geçici bir dönem değil — bazı yerler ev gibi gelir.`)}</Sub>
        </>
      ),
    });
  }

  if (stats.most_watched_director?.name) {
    const directorProfile = stats.top_directors?.find((d) => d.name === stats.most_watched_director?.name);
    slides.push({
      key: 'director',
      media: compactMedia([
        profileMedia(directorProfile),
        ...personFilmPosters(stats, stats.most_watched_director.name, 'director', Number.POSITIVE_INFINITY),
      ], Number.POSITIVE_INFINITY),
      accent: '#ef4444',
      visual: 'director',
      body: (
        <>
          <Label>{copy('Your comfort zone had subtitles', 'Konfor alanında altyazılar vardı')}</Label>
          <Big>{stats.most_watched_director.name}</Big>
          <Sub>
            {copy(`${stats.most_watched_director.count} films together — an auteur you kept returning to.`, `${stats.most_watched_director.count} film birlikte — tekrar tekrar döndüğün bir auteur.`)}
          </Sub>
        </>
      ),
    });
  }

  if (stats.average_rating != null) {
    slides.push({
      key: 'taste',
      media: compactMedia([
        posterMedia(stats.rating_outlier_film),
        ...broadPosters,
      ], 7),
      accent: '#eab308',
      visual: 'hero',
      body: (
        <>
          <Label>{copy('The verdicts', 'Hükümler')}</Label>
          <Big>{stats.average_rating.toFixed(2)} ★</Big>
          {stats.total_countries
            ? <Sub>{copy(`Your average rating across ${stats.total_countries} countries of cinema. Not generous, not cruel — just honest.`, `Sinemanın ${stats.total_countries} ülkesi boyunca ortalama puanın. Cömert değil, acımasız değil — sadece dürüst.`)}</Sub>
            : <Sub>{copy('Your average rating. Not generous, not cruel — just honest.', 'Ortalama puanın. Cömert değil, acımasız değil — sadece dürüst.')}</Sub>}
        </>
      ),
    });
  }

  if (stats.rating_personality || stats.most_common_rating != null) {
    const generousPosters = stats.rating_personality === 'The Generous Critic'
      ? generousCriticPosters(stats)
      : [];
    slides.push({
      key: 'rating-personality',
      media: generousPosters.length > 0
        ? generousPosters
        : compactMedia([posterMedia(stats.rating_outlier_film), ...topRatedPosters(stats, 8)], 9),
      accent: '#a3e635',
      visual: generousPosters.length > 0 ? 'poster-wall' : 'strip',
      body: (
        <>
          <Label>{copy('How you judge', 'Nasıl yargılıyorsun')}</Label>
          <Big>{stats.rating_personality ?? copy(`${stats.most_common_rating} ★, mostly`, `çoğunlukla ${stats.most_common_rating} ★`)}</Big>
          {stats.most_common_rating != null ? (
            <Sub>
              {stats.most_common_rating <= 2.5
                ? copy(`You gave ${stats.most_common_rating} ★ more than anything else. You know what you don't like, and you’re not quiet about it.`, `Her şeyden çok ${stats.most_common_rating} ★ verdin. Neyi sevmediğini biliyorsun ve saklamıyorsun.`)
                : stats.most_common_rating >= 4
                  ? copy(`You gave ${stats.most_common_rating} ★ more than anything else. An optimist, or just easily pleased?`, `Her şeyden çok ${stats.most_common_rating} ★ verdin. İyimser misin, yoksa kolay mı memnun oluyorsun?`)
                  : copy(`You gave ${stats.most_common_rating} ★ more than anything else. The solid middle — no regrets, no hype.`, `Her şeyden çok ${stats.most_common_rating} ★ verdin. Sağlam orta — pişmanlık yok, abartı yok.`)}
            </Sub>
          ) : null}
        </>
      ),
    });
  }

  const reviews = stats.review_analysis?.reviews ?? [];
  if (reviews.length > 0) {
    const longest = reviews.reduce((a, b) =>
      reviewWordCount(b) !== reviewWordCount(a)
        ? (reviewWordCount(b) > reviewWordCount(a) ? b : a)
        : (reviewCharLength(b) > reviewCharLength(a) ? b : a),
    );
    const longestLikes = longest.likes ?? 0;
    slides.push({
      key: 'review-personality',
      media: compactMedia([
        posterMedia(filmByTitle(stats, longest.title)),
        ...broadPosters,
      ], 6),
      accent: '#fb7185',
      visual: 'hero',
      body: (
        <>
          <Label>{copy('Your longest review', 'En uzun incelemen')}</Label>
          <Big>{longest.title}</Big>
          <Sub>
            {stats.review_analysis?.total_words_written
              ? copy(`${stats.review_analysis.total_words_written.toLocaleString()} words written total. `, `Toplam ${stats.review_analysis.total_words_written.toLocaleString()} kelime yazdın. `)
              : ''}
            {longestLikes === 0
              ? copy('Your longest review got 0 likes, but it had conviction. Some stories are for the writer, not the crowd.', 'En uzun incelemen 0 beğeni aldı ama bir duruşu vardı. Bazı hikâyeler kalabalık için değil, yazar içindir.')
              : copy(`That one got ${longestLikes} like${longestLikes === 1 ? '' : 's'} — someone out there gets you.`, `${longestLikes} beğeni aldı — birileri seni anlıyor.`)}
          </Sub>
        </>
      ),
    });
  }

  if (stats.sinefil_meter?.score != null) {
    slides.push({
      key: 'sinefil',
      media: compactMedia([
        ...genrePosters(stats, undefined, 10),
      ], 10),
      accent: '#67e8f9',
      visual: 'mosaic',
      body: (
        <>
          <Label>{copy('How deep the rabbit hole goes', 'Tavşan deliğinin derinliği')}</Label>
          <Big>{stats.sinefil_meter.score} / 100</Big>
          {stats.sinefil_meter.type && <Sub>{copy('Your cinema scale says you’re a ', 'Sinema ölçeğin şunu söylüyor: ')}<strong>{stats.sinefil_meter.type}</strong>{copy('. You’ve wandered past the mainstream into something more specific.', '. Ana akımın ötesine, daha spesifik bir yere yürümüşsün.')}</Sub>}
        </>
      ),
    });
  }

  if (stats.cinematic_persona?.persona) {
    const basis = stats.cinematic_persona_basis;
    slides.push({
      key: 'persona',
      media: genrePosters(stats, basis?.genre ?? stats.favorite_genre?.name, 12),
      accent: '#c084fc',
      visual: 'poster-wall',
      body: (
        <>
          <Label>{copy('Which makes you', 'Bu da seni şuna dönüştürüyor')}</Label>
          <Big>{stats.cinematic_persona.persona}</Big>
          {stats.cinematic_persona.description && <Sub>{stats.cinematic_persona.description}</Sub>}
          {basis?.genre && (
            <Sub className="text-stone-300">
              {basis.genre} {copy('was your most-watched genre', 'en çok izlediğin türdü')}
              {basis.match_type === 'genre_decade_country'
                ? copy(`, shaped by your ${basis.decade} and ${basis.country} streak.`, `; ${basis.decade} ve ${basis.country} serin bunu şekillendirdi.`)
                : copy(' — the strongest signal behind this persona.', ' — bu personanın en güçlü sinyali.')}
            </Sub>
          )}
        </>
      ),
    });
  }

  slides.push({
    key: 'outro',
    media: compactMedia([
      profileMedia(topActor),
      profileMedia(stats.top_directors?.find((d) => d.name === directorName) ?? stats.top_directors?.[0]),
      ...broadPosters,
    ], 9),
    accent: '#fbbf24',
    visual: 'mosaic',
    body: (
      <>
        <Label>{copy('That’s the short version', 'Kısa versiyon buydu')}</Label>
        <Big>{copy('The full picture waits.', 'Tüm resim seni bekliyor.')}</Big>
      </>
    ),
  });

  return slides;
}
