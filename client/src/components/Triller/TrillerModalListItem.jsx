import React from 'react';
import { useImageLoadState } from '../../hooks/useImageLoadState';
import LoaderSkeleton from '../LoaderSkeleton/LoaderSkeleton';

const getLocalized = (value, lang) => {
  if (!value) return '';
  if (typeof value === 'object') {
    return value[lang] || value.uz || value.ru || '';
  }
  return String(value);
};

const TrillerModalListItem = ({ row, isActive, contentLang, onSelect }) => {
  const rowName = getLocalized(row?.name, contentLang);
  const rowDesc = getLocalized(row?.description, contentLang);
  const imgSrc = row?.img ? encodeURI(row.img) : '';
  const { imgRef, showLoading, onLoad, onError } = useImageLoadState(imgSrc);

  return (
    <button
      type="button"
      className={[
        'triller-modal-list-item',
        isActive ? 'is-active' : '',
        showLoading ? 'is-loading' : '',
      ].filter(Boolean).join(' ')}
      onClick={() => {
        if (!isActive && !showLoading) onSelect?.(row);
      }}
      disabled={showLoading}
    >
      <div className="triller-modal-list-thumb">
        {showLoading ? (
          <LoaderSkeleton variant="image" className="triller-modal-list-thumb-skeleton" />
        ) : null}
        {imgSrc ? (
          <img
            ref={imgRef}
            src={imgSrc}
            alt={rowName || ''}
            loading="lazy"
            className={showLoading ? 'is-loading' : ''}
            onLoad={onLoad}
            onError={onError}
          />
        ) : (
          <span className="triller-modal-list-thumb-empty" />
        )}
      </div>
      <div className="triller-modal-list-info">
        {showLoading ? (
          <>
            <div className="triller-modal-list-name-slot" aria-hidden="true">
              <LoaderSkeleton variant="text" className="triller-modal-list-name-skeleton" />
            </div>
            <div className="triller-modal-list-description-slot" aria-hidden="true">
              <LoaderSkeleton variant="text" className="triller-modal-list-description-skeleton" />
            </div>
          </>
        ) : (
          <>
            {rowName ? <p className="triller-modal-list-name">{rowName}</p> : null}
            {rowDesc ? <p className="triller-modal-list-description">{rowDesc}</p> : null}
          </>
        )}
      </div>
    </button>
  );
};

export default TrillerModalListItem;
