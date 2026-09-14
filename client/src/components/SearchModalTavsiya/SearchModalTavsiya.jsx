import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useContentLanguage } from '../../context/ContentLanguageContext';
import { useViewedMovies } from '../../context/ViewedMoviesContext';
import { useMoviesCatalog } from '../../context/MoviesCatalogContext';
import { fetchRecommendations } from '../../api/recommendationsApi';
import { normalizeMediaUrl } from '../../utils/mediaUrl';
import { getMovieAgeRestriction } from '../../utils/utils';
import { useImageLoadState } from '../../hooks/useImageLoadState';
import LoaderSkeleton from '../LoaderSkeleton/LoaderSkeleton';
import './SearchModalTavsiya.css';

const getTitle = (movie, contentLang) => {
  if (movie?.title && typeof movie.title === 'object') {
    return movie.title[contentLang] || movie.title.uz || movie.title.ru;
  }
  return movie?.title || '';
};

const getImg = (movie, contentLang) => {
  if (movie?.homeImg && typeof movie.homeImg === 'object') {
    return movie.homeImg[contentLang] || movie.homeImg.uz || movie.homeImg.ru;
  }
  return movie?.homeImg || '';
};

const TavsiyaItem = ({ movie, contentLang, t, onClick }) => {
  const imgSrc = normalizeMediaUrl(getImg(movie, contentLang));
  const { imgRef, showLoading, onLoad, onError } = useImageLoadState(imgSrc);
  const ageRestriction = getMovieAgeRestriction(movie);

  return (
    <div
      className={`search-modal-tavsiya-item${showLoading ? ' is-loading' : ''}`}
      onClick={() => !showLoading && onClick?.(movie)}
    >
      <div className="search-modal-tavsiya-item-image-wrapper">
        {showLoading ? (
          <LoaderSkeleton variant="image" className="search-modal-tavsiya-item-image-skeleton" />
        ) : null}
        {imgSrc ? (
          <img
            ref={imgRef}
            src={imgSrc}
            alt={getTitle(movie, contentLang)}
            className={`search-modal-tavsiya-item-image${showLoading ? ' is-loading' : ''}`}
            loading="lazy"
            onLoad={onLoad}
            onError={onError}
          />
        ) : null}
        {!showLoading ? (
          <>
            {movie.category === 'anonslar' ? (
              <span className="search-modal-tavsiya-badge search-modal-tavsiya-badge-soon">
                {t('searchModal.tezOrada', 'Tez orada')}
              </span>
            ) : (
              <span className="search-modal-tavsiya-badge search-modal-tavsiya-badge-fhd">FHD</span>
            )}
            {ageRestriction != null && (
              <span className="search-modal-tavsiya-badge search-modal-tavsiya-badge-age">
                {ageRestriction}+
              </span>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
};

const SearchModalTavsiya = ({ onMovieClick }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { contentLang } = useContentLanguage();
  const { getViewedItems } = useViewedMovies();
  const { allMovies, ensureFullCatalog } = useMoviesCatalog();
  const [recommendations, setRecommendations] = useState([]);

  useEffect(() => {
    ensureFullCatalog();
  }, [ensureFullCatalog]);

  useEffect(() => {
    const viewedItems = getViewedItems();
    fetchRecommendations(viewedItems, 12, allMovies).then(setRecommendations);
  }, [allMovies, getViewedItems]);

  const handleClick = (movie) => {
    if (onMovieClick) onMovieClick();
    navigate(`/movie/${movie.id}`);
  };

  if (recommendations.length === 0) return null;

  return (
    <div className="search-modal-tavsiya">
      <h3 className="search-modal-tavsiya-title">{t('searchModal.tavsiyaEtamiz', 'Tavsiya etamiz')}</h3>
      <div className="search-modal-tavsiya-list">
        {recommendations.map((movie) => (
          <TavsiyaItem
            key={movie.id}
            movie={movie}
            contentLang={contentLang}
            t={t}
            onClick={handleClick}
          />
        ))}
      </div>
    </div>
  );
};

export default SearchModalTavsiya;
