import React from 'react';
import { normalizeMediaUrl } from '../../utils/mediaUrl';
import { useImageLoadState } from '../../hooks/useImageLoadState';
import LoaderSkeleton from '../LoaderSkeleton/LoaderSkeleton';

const ProfileAvatar = ({ src, ariaLabel }) => {
  const normalizedSrc = src ? normalizeMediaUrl(src) : '';
  const { imgRef, showLoading, onLoad, onError } = useImageLoadState(normalizedSrc);

  return (
    <div
      className={`profile-avatar-wrap${showLoading ? ' is-loading' : ''}`}
      aria-label={ariaLabel}
    >
      {showLoading ? (
        <LoaderSkeleton variant="avatar" className="profile-avatar-skeleton" />
      ) : null}
      {normalizedSrc ? (
        <img
          ref={imgRef}
          src={normalizedSrc}
          alt=""
          className={`profile-avatar-img${showLoading ? ' is-loading' : ''}`}
          onLoad={onLoad}
          onError={onError}
        />
      ) : (
        <svg
          className="profile-avatar-icon"
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      )}
    </div>
  );
};

export default ProfileAvatar;
