import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { fetchWeeklyTopMovies, WEEKLY_TOP_LIMIT } from '../../api/moviesApi';
import HorizontalScroll from '../HorizontalScroll/HorizontalScroll';
import LoaderSkeleton from '../LoaderSkeleton/LoaderSkeleton';
import MovieItem from '../Movies/MovieItem';
import './WeeklyTopMovies.css';

const WeeklyTopMovies = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [movies, setMovies] = React.useState([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        setIsLoading(true);
        const data = await fetchWeeklyTopMovies({ limit: WEEKLY_TOP_LIMIT });
        if (isMounted) {
          setMovies(data.items || []);
        }
      } catch (error) {
        console.error('[WeeklyTopMovies] yuklashda xatolik:', error?.message || error);
        if (isMounted) setMovies([]);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    load();
    return () => {
      isMounted = false;
    };
  }, []);

  // Bo'sh bo'lim (hech kim login qilib ko'rmagan) — ko'rsatilmaydi
  if (!isLoading && movies.length === 0) {
    return null;
  }

  const handleMovieClick = (movieId) => {
    navigate(`/movie/${movieId}`);
  };

  return (
    <div className="movies weekly-top">
      <div className="movies-container">
        <div className="movies-header">
          {isLoading ? (
            <LoaderSkeleton variant="text" className="movies-title-skeleton" width="260px" height="28px" />
          ) : (
            <h2 className="movies-title">{t('movies.weeklyTop')}</h2>
          )}
        </div>

        <div className="movies-content-wrapper">
          <HorizontalScroll>
            {isLoading
              ? Array.from({ length: WEEKLY_TOP_LIMIT }).map((_, index) => (
                  <div key={`weekly-top-ph-${index}`} className="weekly-top-item">
                    <span className="weekly-top-rank" aria-hidden="true">
                      <span className="weekly-top-rank-text" data-rank={index + 1}>{index + 1}</span>
                    </span>
                    <div className="movies-item movies-item-horizontal weekly-top-card">
                      <div className="movies-item-image-wrapper">
                        <LoaderSkeleton variant="image" />
                      </div>
                      <LoaderSkeleton variant="text" className="movies-item-title-skeleton" width="85%" height={16} />
                    </div>
                  </div>
                ))
              : movies.map((movie, index) => {
                  const rank = movie.weeklyRank || index + 1;
                  const isWideRank = rank >= 10;

                  return (
                    <div
                      key={`${movie.id}-${rank}`}
                      className={`weekly-top-item${isWideRank ? ' weekly-top-item--wide' : ''}`}
                    >
                      <span className="weekly-top-rank" aria-hidden="true">
                        <span className="weekly-top-rank-text" data-rank={rank}>{rank}</span>
                      </span>
                      <MovieItem
                        movie={movie}
                        isDataLoading={isLoading}
                        isHorizontal
                        className="weekly-top-card"
                        onMovieClick={handleMovieClick}
                      />
                    </div>
                  );
                })}
          </HorizontalScroll>
        </div>
      </div>
    </div>
  );
};

export default WeeklyTopMovies;
