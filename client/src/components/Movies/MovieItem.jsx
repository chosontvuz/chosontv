import React from 'react';
import { useTranslation } from 'react-i18next';
import { useWishlist } from '../../context/WishlistContext';
import { useContentLanguage } from '../../context/ContentLanguageContext';
import { normalizeMediaUrl } from '../../utils/mediaUrl';
import { getMovieAgeRestriction } from '../../utils/utils';
import { useImageLoadState } from '../../hooks/useImageLoadState';
import LoaderSkeleton from '../LoaderSkeleton/LoaderSkeleton';

const getMovieTitle = (movie, contentLang) => {
  if (movie.title && typeof movie.title === 'object') {
    return movie.title[contentLang] || movie.title.uz || movie.title.ru;
  }
  return movie.title || '';
};

const getImdbRating = (movie) => {
  const value = movie?.ratingImdb;
  if (value == null || value === '' || value === 'none') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const MovieItem = ({
  movie,
  isDataLoading = false,
  isHorizontal = false,
  isWideLayout = false,
  className = '',
  onMovieClick,
}) => {
  const { t } = useTranslation();
  const { toggleWishlist, isInWishlist } = useWishlist();
  const { contentLang } = useContentLanguage();
  const title = getMovieTitle(movie, contentLang);
  const imgSrc = normalizeMediaUrl(
    movie.homeImg
      ? movie.homeImg[contentLang] || movie.homeImg.uz || movie.homeImg.ru
      : ''
  );
  const imageEnabled = Boolean(imgSrc) && !isDataLoading;
  const { imgRef, showLoading: imageLoading, onLoad, onError } = useImageLoadState(imgSrc, {
    enabled: imageEnabled,
  });

  const showLoading = isDataLoading || imageLoading;
  const imdbRating = getImdbRating(movie);
  const ageRestriction = getMovieAgeRestriction(movie);

  return (
    <div
      className={`movies-item ${isHorizontal ? 'movies-item-horizontal' : ''} ${isWideLayout ? 'movies-item-wide' : ''} ${className}`.trim()}
      onClick={() => !showLoading && onMovieClick?.(movie.id)}
    >
      <div className="movies-item-image-wrapper">
        {showLoading && <LoaderSkeleton variant="image" />}
        {imageEnabled ? (
          <img
            ref={imgRef}
            src={imgSrc}
            alt={title}
            className={`movies-item-image ${showLoading ? 'is-loading' : ''}`}
            loading="lazy"
            onLoad={onLoad}
            onError={onError}
          />
        ) : null}
        {!showLoading && (
          <>
            <button
              className={`movies-item-wishlist-btn ${isInWishlist(movie.id) ? 'active' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                toggleWishlist(movie.id);
              }}
              aria-label="Sevimlilarga qo'shish"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill={isInWishlist(movie.id) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
              </svg>
            </button>
            {movie.category === 'anonslar' ? (
              <div className="movies-item-badge movies-item-badge-soon">{t('searchModal.tezOrada', 'Tez orada')}</div>
            ) : (
              <div className="movies-item-badge movies-item-badge-fhd">FHD</div>
            )}
            {ageRestriction != null && (
              <div className="movies-item-badge movies-item-badge-age">{ageRestriction}+</div>
            )}
            {imdbRating != null && (
              <div className="movies-item-rating">
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
                {imdbRating}
              </div>
            )}
          </>
        )}
      </div>
      {showLoading ? (
        <LoaderSkeleton variant="text" className="movies-item-title-skeleton" width="85%" height={16} />
      ) : (
        title && <p className="movies-item-title">{title}</p>
      )}
    </div>
  );
};

export default MovieItem;
