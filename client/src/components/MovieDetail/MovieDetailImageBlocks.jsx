import React from 'react';
import { normalizeMediaUrl } from '../../utils/mediaUrl';
import { useImageLoadState } from '../../hooks/useImageLoadState';
import LoaderSkeleton from '../LoaderSkeleton/LoaderSkeleton';

export const MovieDetailMediaImage = ({ src, alt }) => {
  const normalizedSrc = src ? normalizeMediaUrl(src) : '';
  const { imgRef, showLoading, onLoad, onError } = useImageLoadState(normalizedSrc);

  if (!normalizedSrc) {
    return (
      <div className="movie-detail-video-placeholder">
        <span>Rasm topilmadi</span>
      </div>
    );
  }

  return (
    <div className={`movie-detail-video-wrapper${showLoading ? ' is-loading' : ''}`}>
      {showLoading ? (
        <LoaderSkeleton variant="detail-image" className="movie-detail-video-skeleton" />
      ) : null}
      <img
        ref={imgRef}
        src={normalizedSrc}
        alt={alt}
        className={`movie-detail-video${showLoading ? ' is-loading' : ''}`}
        onLoad={onLoad}
        onError={onError}
      />
    </div>
  );
};

export const MovieDetailTitleImage = ({ src, alt, srTitle }) => {
  const normalizedSrc = src ? normalizeMediaUrl(src) : '';
  const { imgRef, showLoading, onLoad, onError } = useImageLoadState(normalizedSrc);

  if (!normalizedSrc) {
    return null;
  }

  return (
    <div className={`movie-detail-title-img-wrapper${showLoading ? ' is-loading' : ''}`}>
      {showLoading ? (
        <div className="movie-detail-title-img-slot" aria-hidden="true">
          <LoaderSkeleton variant="detail-title" className="movie-detail-title-img-skeleton" />
        </div>
      ) : null}
      <img
        ref={imgRef}
        src={normalizedSrc}
        alt={alt}
        className={`movie-detail-title-img${showLoading ? ' is-loading' : ''}`}
        onLoad={onLoad}
        onError={onError}
      />
      {srTitle ? <h1 className="movie-detail-title movie-detail-title-sr-only">{srTitle}</h1> : null}
    </div>
  );
};

export const MovieDetailActorItem = ({ actor, contentLang, onClick }) => {
  const name = actor?.name?.[contentLang] || actor?.name?.uz || actor?.name?.ru || '';
  const description = actor?.info?.[contentLang] || actor?.info?.uz || actor?.info?.ru || '';
  const normalizedSrc = actor?.image ? normalizeMediaUrl(actor.image) : '';
  const { imgRef, showLoading, onLoad, onError } = useImageLoadState(normalizedSrc);

  return (
    <div
      className={`movie-detail-actor-item${showLoading ? ' is-loading' : ''}`}
      onClick={() => !showLoading && onClick?.(actor.actorId)}
      role="button"
      tabIndex={showLoading ? -1 : 0}
      onKeyDown={(e) => {
        if (!showLoading && e.key === 'Enter') onClick?.(actor.actorId);
      }}
    >
      <div className="movie-detail-actor-image">
        {showLoading ? (
          <LoaderSkeleton variant="avatar" className="movie-detail-actor-image-skeleton" />
        ) : null}
        {normalizedSrc ? (
          <img
            ref={imgRef}
            src={normalizedSrc}
            alt={name}
            className={showLoading ? 'is-loading' : ''}
            onLoad={onLoad}
            onError={onError}
          />
        ) : null}
      </div>
      <div className="movie-detail-actor-info">
        {showLoading ? (
          <div className="movie-detail-actor-name-slot" aria-hidden="true">
            <LoaderSkeleton variant="text" className="movie-detail-actor-name-skeleton" />
          </div>
        ) : (
          <span className="movie-detail-actor-name">{name}</span>
        )}
        {description ? <p className="movie-detail-actor-desc">{description}</p> : null}
      </div>
    </div>
  );
};
