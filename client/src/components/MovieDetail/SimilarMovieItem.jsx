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

const SimilarMovieItem = ({ movie, onMovieClick }) => {
  const { t } = useTranslation();
  const { toggleWishlist, isInWishlist } = useWishlist();
  const { contentLang } = useContentLanguage();
  const title = getMovieTitle(movie, contentLang);
  const imgSrc = normalizeMediaUrl(
    movie.homeImg
      ? movie.homeImg[contentLang] || movie.homeImg.uz || movie.homeImg.ru
      : ''
  );
  const { imgRef, showLoading, onLoad, onError } = useImageLoadState(imgSrc);
  const ageRestriction = getMovieAgeRestriction(movie);

  return (
    <div
      className={`similar-movies-item${showLoading ? ' is-loading' : ''}`}
      onClick={() => !showLoading && onMovieClick?.(movie.id)}
    >
      <div className="similar-movies-item-image-wrapper">
        {showLoading ? (
          <LoaderSkeleton
            variant="similar-movies-item-image"
            className="similar-movies-item-image-skeleton"
          />
        ) : null}
        {imgSrc ? (
          <img
            ref={imgRef}
            src={imgSrc}
            alt={title}
            className={`similar-movies-item-image${showLoading ? ' is-loading' : ''}`}
            loading="lazy"
            onLoad={onLoad}
            onError={onError}
          />
        ) : null}
        {!showLoading ? (
          <>
            <button
              className={`similar-movies-item-wishlist-btn ${isInWishlist(movie.id) ? 'active' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                toggleWishlist(movie.id);
              }}
              aria-label={t('wishlist.add') || "Sevimlilarga qo'shish"}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill={isInWishlist(movie.id) ? 'currentColor' : 'none'}
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            </button>
            {movie.category === 'anonslar' ? (
              <div className="similar-movies-item-badge similar-movies-item-badge-soon">
                {t('searchModal.tezOrada', 'Tez orada')}
              </div>
            ) : (
              <div className="similar-movies-item-badge similar-movies-item-badge-fhd">
                FHD
              </div>
            )}
            {ageRestriction != null && (
              <div className="similar-movies-item-badge similar-movies-item-badge-age">
                {ageRestriction}+
              </div>
            )}
          </>
        ) : null}
      </div>
      {showLoading ? (
        <div className="similar-movies-item-title-slot" aria-hidden="true">
          <LoaderSkeleton variant="text" className="similar-movies-item-title-skeleton" width="85%" height={16} />
        </div>
      ) : (
        title && <p className="similar-movies-item-title">{title}</p>
      )}
    </div>
  );
};

export default SimilarMovieItem;
