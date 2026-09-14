import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useContentLanguage } from '../../context/ContentLanguageContext';
import { useViewedMovies } from '../../context/ViewedMoviesContext';
import { useAuthModal } from '../../context/AuthModalContext';
import { getAuthToken } from '../../utils/authStorage';
import { fetchActiveAd } from '../../api/adsApi';
import { getVideoEmbed } from '../../utils/videoEmbed';
import {
  getFirstEpisodeUrl,
  getMovieWatchSourceUrl,
  isUsableVideoUrl,
} from '../../utils/getWatchPlaybackUrl';
import VideoLoader from '../VideoLoader/VideoLoader';
import { pushTelegramOverlayClose, popTelegramOverlayClose, getTelegramWebApp } from '../TelegramBackButton/TelegramBackButton';
import './WatchModal.css';

const AD_INTERVAL_SECONDS = 900; // 15 daqiqa

const WatchModal = ({ movie, videoUrl, onClose }) => {
  const { t } = useTranslation();
  const { contentLang } = useContentLanguage();
  const { addMovie } = useViewedMovies();
  const { openAuthModal } = useAuthModal();
  const pendingMarkViewedRef = useRef(false);

  const dualWatchAvailable =
    !videoUrl &&
    movie?.watchVideo &&
    typeof movie.watchVideo === 'object' &&
    isUsableVideoUrl(movie.watchVideo.uz) &&
    isUsableVideoUrl(movie.watchVideo.ru);

  const [watchVideoTrack, setWatchVideoTrack] = useState(() => {
    if (
      !videoUrl &&
      isUsableVideoUrl(movie?.watchVideo?.uz) &&
      isUsableVideoUrl(movie?.watchVideo?.ru)
    ) {
      return contentLang === 'ru' ? 'ru' : 'uz';
    }
    return 'uz';
  });

  // Faqat boshqa kino yoki videoUrl o'zgaganda boshlang'ich track; sahifa tili o'zgarsa modal ichidagi tanlov saqlanadi
  useEffect(() => {
    const wv = movie?.watchVideo;
    if (
      !videoUrl &&
      isUsableVideoUrl(wv?.uz) &&
      isUsableVideoUrl(wv?.ru)
    ) {
      setWatchVideoTrack(contentLang === 'ru' ? 'ru' : 'uz');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- contentLang bu yerda faqat yangi kino tanlanganda o'qiladi
  }, [movie?.id, videoUrl]);

  const getWatchVideo = () => {
    if (isUsableVideoUrl(videoUrl)) return String(videoUrl).trim();
    const fromWatch = getMovieWatchSourceUrl(movie, {
      lang: contentLang,
      watchVideoTrack,
    });
    if (fromWatch) return fromWatch;
    // Watch bo'sh: faqat 1-qisim (episodes[0]) — 2/3/4 fallback yo'q
    return getFirstEpisodeUrl(movie, contentLang);
  };

  const watchSrc = getWatchVideo();
  const videoEmbed = useMemo(
    () => getVideoEmbed(watchSrc, { autoplay: true }),
    [watchSrc]
  );
  const isEmbedPlayer = Boolean(videoEmbed?.embedUrl);
  const [embedStarted, setEmbedStarted] = useState(false);

  const embedPoster = useMemo(() => {
    const lang = contentLang === 'ru' ? 'ru' : 'uz';
    return (
      movie?.homeImg?.[lang] ||
      movie?.homeImg?.uz ||
      movie?.homeImg?.ru ||
      movie?.movieMedia?.[lang]?.img?.src ||
      movie?.movieMedia?.uz?.img?.src ||
      movie?.movieMedia?.ru?.img?.src ||
      ''
    );
  }, [movie, contentLang]);

  useEffect(() => {
    setEmbedStarted(false);
  }, [watchSrc, movie?.id]);

  const videoRef = useRef(null);
  const videoWrapperRef = useRef(null);
  const adVideoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showControls, setShowControls] = useState(true);

  // Reklama state
  const [showAdOverlay, setShowAdOverlay] = useState(false);
  const hasUserStartedWatchingRef = useRef(false);
  const lastAdAtVideoTimeRef = useRef(-1); // -1 = birinchi reklama hali ko'rsatilmagan

  // useRef - stale closure muammosini hal qilish uchun
  const hideControlsTimeoutRef = useRef(null);
  const isPlayingRef = useRef(false);
  const showControlsRef = useRef(true);

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [previewTime, setPreviewTime] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPseudoFullscreen, setIsPseudoFullscreen] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [isVideoBuffering, setIsVideoBuffering] = useState(true);

  const handleWatchVideoTrackChange = (track) => {
    if (!dualWatchAvailable || (track !== 'uz' && track !== 'ru')) return;
    setWatchVideoTrack(track);
    setCurrentTime(0);
    setDuration(0);
    setPreviewTime(0);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
    setShowAdOverlay(false);
    hasUserStartedWatchingRef.current = false;
    lastAdAtVideoTimeRef.current = -1;
  };
  
  const speedOptions = [1, 1.5, 2];

  const [activeAd, setActiveAd] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const loadActiveAd = async () => {
      try {
        const ad = await fetchActiveAd();
        if (isMounted) {
          setActiveAd(ad);
        }
      } catch (_error) {
        if (isMounted) {
          setActiveAd(null);
        }
      }
    };

    loadActiveAd();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleAdEnded = () => {
    setShowAdOverlay(false);
    if (adVideoRef.current) {
      adVideoRef.current.pause();
      adVideoRef.current.currentTime = 0;
    }
    if (videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
    if (!hasUserStartedWatchingRef.current) {
      hasUserStartedWatchingRef.current = true;
      lastAdAtVideoTimeRef.current = 0;
    }
  };

  const showAd = () => {
    if (!activeAd || !activeAd.isActive) return;
    if (videoRef.current) {
      videoRef.current.pause();
    }
    setShowAdOverlay(true);
    setTimeout(() => {
      if (adVideoRef.current) {
        adVideoRef.current.currentTime = 0;
        adVideoRef.current.play().catch(() => {});
      }
    }, 100);
  };

  const ensureAuthForPlay = () => {
    if (getAuthToken()) return true;
    openAuthModal();
    return false;
  };

  const handlePlayPause = () => {
    if (showAdOverlay) return;
    if (videoRef.current) {
      if (isPlayingRef.current) {
        videoRef.current.pause();
      } else {
        if (!ensureAuthForPlay()) return;
        if (!hasUserStartedWatchingRef.current && activeAd?.isActive) {
          showAd();
          return;
        }
        if (!hasUserStartedWatchingRef.current) {
          hasUserStartedWatchingRef.current = true;
        }
        videoRef.current.play().catch(() => {});
      }
    }
    showControlsWithDelay();
  };

  // Faqat .watch-modal-control-btn-play → play boshlansa «ko'rildi» (+ weekly top)
  const handleControlPlayClick = (e) => {
    e?.stopPropagation?.();

    // Mover/YouTube embed: mavjud play tugmasi orqali start + viewed
    if (isEmbedPlayer && !embedStarted) {
      if (!ensureAuthForPlay()) return;
      pendingMarkViewedRef.current = true;
      setEmbedStarted(true);
      if (movie && pendingMarkViewedRef.current) {
        pendingMarkViewedRef.current = false;
        addMovie(movie);
      }
      return;
    }

    const willStartPlayback = !isPlayingRef.current && !showAdOverlay;
    if (willStartPlayback) {
      if (!ensureAuthForPlay()) return;
      pendingMarkViewedRef.current = true;
    }
    handlePlayPause();
  };

  // Asosiy video play bo'lganda (reklama video emas) belgilash
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;

    const onPlay = () => {
      if (!pendingMarkViewedRef.current || !movie) return;
      pendingMarkViewedRef.current = false;
      addMovie(movie);
    };

    video.addEventListener('play', onPlay);
    return () => video.removeEventListener('play', onPlay);
  }, [movie, addMovie]);

  // Ref larni state bilan sinxronlashtirish
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    showControlsRef.current = showControls;
  }, [showControls]);

  const clearHideTimeout = useCallback(() => {
    if (hideControlsTimeoutRef.current) {
      clearTimeout(hideControlsTimeoutRef.current);
      hideControlsTimeoutRef.current = null;
    }
  }, []);

  const startHideTimeout = useCallback(() => {
    clearHideTimeout();
    hideControlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
      showControlsRef.current = false;
      setShowSpeedMenu(false);
    }, 4000);
  }, [clearHideTimeout]);

  const handleBack10 = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10);
    }
    showControlsWithDelay();
  };

  const handleForward10 = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.min(videoRef.current.duration, videoRef.current.currentTime + 10);
    }
    showControlsWithDelay();
  };

  const toggleMute = () => {
    if (videoRef.current) {
      const newMuted = !isMuted;
      setIsMuted(newMuted);
      videoRef.current.muted = newMuted;
      if (newMuted) {
        videoRef.current.volume = 0;
      } else {
        videoRef.current.volume = volume || 0.5;
        setVolume(volume || 0.5);
      }
    }
  };

  const handleSpeedChange = (speed) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) {
      try {
        videoRef.current.playbackRate = speed;
      } catch (error) {
        console.error('Error setting playback rate:', error);
      }
    }
    setShowSpeedMenu(false);
    showControlsWithDelay();
  };

  const handleFullscreen = () => {
    if (!videoWrapperRef.current) return;

    const isNativeFullscreen = () => Boolean(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement
    );

    const requestNativeFullscreen = async () => {
      const wrapper = videoWrapperRef.current;
      const video = videoRef.current;

      try {
        if (wrapper.requestFullscreen) {
          await wrapper.requestFullscreen();
          return true;
        }
        if (wrapper.webkitRequestFullscreen) {
          wrapper.webkitRequestFullscreen();
          return true;
        }
        if (wrapper.mozRequestFullScreen) {
          wrapper.mozRequestFullScreen();
          return true;
        }
        if (wrapper.msRequestFullscreen) {
          wrapper.msRequestFullscreen();
          return true;
        }
        if (video && video.webkitEnterFullscreen) {
          video.webkitEnterFullscreen();
          return true;
        }
      } catch (_) {
        return false;
      }

      return false;
    };

    const exitNativeFullscreen = async () => {
      try {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
          return true;
        }
        if (document.webkitExitFullscreen) {
          document.webkitExitFullscreen();
          return true;
        }
        if (document.mozCancelFullScreen) {
          document.mozCancelFullScreen();
          return true;
        }
        if (document.msExitFullscreen) {
          document.msExitFullscreen();
          return true;
        }
      } catch (_) {
        return false;
      }

      return false;
    };

    const toggleFullscreen = async () => {
      if (isNativeFullscreen()) {
        const exited = await exitNativeFullscreen();
        if (!exited) setIsPseudoFullscreen(false);
        return;
      }

      if (isPseudoFullscreen) {
        setIsPseudoFullscreen(false);
        return;
      }

      const entered = await requestNativeFullscreen();
      if (!entered) {
        // Telegram WebApp kabi brauzerlarda Fullscreen API bloklansa fallback.
        setIsPseudoFullscreen(true);
      }
    };

    toggleFullscreen().catch((error) => {
      console.error('Error toggling fullscreen:', error);
      setIsPseudoFullscreen((prev) => !prev);
    });
  };

  const formatTime = (seconds) => {
    if (isNaN(seconds) || !isFinite(seconds) || seconds < 0) return '0:00';
    const totalSeconds = Math.floor(seconds);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const ct = videoRef.current.currentTime;
      setCurrentTime(ct);
      if (showAdOverlay) return;
      if (isPlayingRef.current && hasUserStartedWatchingRef.current && activeAd?.isActive) {
        const nextAdSlot = Math.floor(ct / AD_INTERVAL_SECONDS);
        if (nextAdSlot > lastAdAtVideoTimeRef.current) {
          lastAdAtVideoTimeRef.current = nextAdSlot;
          showAd();
        }
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current && videoRef.current.duration) {
      setDuration(videoRef.current.duration);
      videoRef.current.playbackRate = playbackSpeed;
    }
  };

  const updateProgress = (clientX, progressContainer) => {
    if (videoRef.current && videoRef.current.duration && !isNaN(videoRef.current.duration) && progressContainer) {
      const rect = progressContainer.getBoundingClientRect();
      const clickX = clientX - rect.left;
      const percent = Math.max(0, Math.min(1, clickX / rect.width));
      const newTime = percent * videoRef.current.duration;
      setPreviewTime(newTime);
      return newTime;
    }
    return 0;
  };

  const handleProgressClick = (e) => {
    e.stopPropagation();
    const newTime = updateProgress(e.clientX, e.currentTarget);
    if (videoRef.current && newTime >= 0) {
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
      setPreviewTime(0);
    }
  };

  const handleProgressMouseDown = (e) => { e.stopPropagation(); setIsDragging(true); updateProgress(e.clientX, e.currentTarget); };
  const handleProgressMouseMove = (e) => { if (isDragging) { e.stopPropagation(); updateProgress(e.clientX, e.currentTarget); } };
  const handleProgressMouseUp = (e) => {
    if (isDragging) {
      e.stopPropagation();
      if (videoRef.current && previewTime >= 0) { videoRef.current.currentTime = previewTime; setCurrentTime(previewTime); setPreviewTime(0); }
      setIsDragging(false);
    }
  };
  const handleProgressTouchStart = (e) => { e.stopPropagation(); setIsDragging(true); updateProgress(e.touches[0].clientX, e.currentTarget); };
  const handleProgressTouchMove = (e) => { e.stopPropagation(); if (isDragging) updateProgress(e.touches[0].clientX, e.currentTarget); };
  const handleProgressTouchEnd = (e) => {
    e.stopPropagation();
    if (isDragging && videoRef.current && previewTime >= 0) { videoRef.current.currentTime = previewTime; setCurrentTime(previewTime); setPreviewTime(0); }
    setIsDragging(false);
  };

  const getProgressPercent = () => {
    if (duration > 0 && !isNaN(duration) && currentTime >= 0 && !isNaN(currentTime)) return Math.min(100, Math.max(0, (currentTime / duration) * 100));
    return 0;
  };

  const getRemainingTime = () => {
    if (duration > 0 && !isNaN(duration) && currentTime >= 0 && !isNaN(currentTime)) return Math.max(0, duration - currentTime);
    return 0;
  };

  const showControlsWithDelay = () => {
    setShowControls(true);
    showControlsRef.current = true;
    if (isPlayingRef.current) {
      startHideTimeout();
    } else {
      clearHideTimeout();
    }
  };

  useEffect(() => {
    if (isPlaying) {
      setShowControls(true);
      showControlsRef.current = true;
      startHideTimeout();
    } else {
      setShowControls(true);
      showControlsRef.current = true;
      clearHideTimeout();
    }
  }, [isPlaying, startHideTimeout, clearHideTimeout]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const nativeActive = Boolean(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement
      );
      setIsFullscreen(nativeActive || isPseudoFullscreen);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    handleFullscreenChange();

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
      clearHideTimeout();
    };
  }, [clearHideTimeout, isPseudoFullscreen]);

  useEffect(() => {
    if (!isPseudoFullscreen) return undefined;

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsPseudoFullscreen(false);
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isPseudoFullscreen]);

  useEffect(() => {
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = originalStyle; };
  }, []);

  useEffect(() => {
    const checkDuration = setInterval(() => {
      if (videoRef.current && videoRef.current.duration && !isNaN(videoRef.current.duration)) {
        setDuration(videoRef.current.duration);
        if (videoRef.current.playbackRate !== playbackSpeed) videoRef.current.playbackRate = playbackSpeed;
        clearInterval(checkDuration);
      }
    }, 100);
    return () => clearInterval(checkDuration);
  }, [movie.watchVideo, movie.watchUrl, movie?.seasons, videoUrl, contentLang, playbackSpeed, watchVideoTrack]);

  useEffect(() => {
    setIsVideoBuffering(true);
  }, [movie?.id, videoUrl, watchVideoTrack, contentLang, movie?.seasons]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showSpeedMenu && !e.target.closest('.watch-modal-speed-menu') && !e.target.closest('.watch-modal-icon-btn')) setShowSpeedMenu(false);
    };
    if (showSpeedMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showSpeedMenu]);

  // Telefon / Telegram orqaga: sahifadan chiqmasdan faqat modal yopiladi
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const closedByPopstateRef = useRef(false);

  useEffect(() => {
    closedByPopstateRef.current = false;
    window.history.pushState({ watchModal: true }, '');

    const closeModal = () => {
      onCloseRef.current();
    };

    const tgHandler = () => closeModal();
    pushTelegramOverlayClose(tgHandler);

    const tg = getTelegramWebApp();
    if (tg?.BackButton) {
      tg.BackButton.show();
    }

    const onPopState = () => {
      closedByPopstateRef.current = true;
      closeModal();
    };

    window.addEventListener('popstate', onPopState);
    return () => {
      popTelegramOverlayClose(tgHandler);
      window.removeEventListener('popstate', onPopState);
      if (!closedByPopstateRef.current) {
        window.history.back();
      }
    };
  }, []);

  const handleOverlayClick = (e) => { if (e.target === e.currentTarget) onClose(); };

  const videoTapRef = useRef({ x: 0, y: 0, time: 0 });

  const handleVideoWrapperTouchStart = (e) => {
    if (!('ontouchstart' in window)) return;
    if (e.target.closest('.watch-modal-control-btn') || e.target.closest('.watch-modal-bottom-controls') || e.target.closest('input')) return;
    const touch = e.touches[0];
    videoTapRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
  };

  const handleVideoWrapperTouchEnd = (e) => {
    if (!('ontouchstart' in window)) return;
    if (e.target.closest('.watch-modal-control-btn') || e.target.closest('.watch-modal-bottom-controls') || e.target.closest('input')) return;
    const touch = e.changedTouches?.[0];
    if (!touch) return;
    const { x, y, time } = videoTapRef.current;
    const dx = Math.abs(touch.clientX - x);
    const dy = Math.abs(touch.clientY - y);
    const dt = Date.now() - time;
    if (dx < 20 && dy < 20 && dt < 300) {
      e.preventDefault();
      // showControlsRef.current - hozirgi qiymatni ref orqali o'qiymiz (stale closure yo'q)
      if (showControlsRef.current) {
        // Yashir
        clearHideTimeout();
        setShowControls(false);
        showControlsRef.current = false;
      } else {
        // Ko'rsat
        setShowControls(true);
        showControlsRef.current = true;
        if (isPlayingRef.current) {
          startHideTimeout();
        }
      }
    }
  };

  const handleVideoClick = (e) => {
    e.stopPropagation();
    if (e.target.closest('button') || e.target.closest('input')) return;
    handlePlayPause();
  };

  return (
    <div className="watch-modal-overlay" onClick={handleOverlayClick}>
      <div className="watch-modal" onClick={(e) => e.stopPropagation()}>
        <div className="watch-modal-content">
          <div className="watch-modal-video-section">
            <div 
              ref={videoWrapperRef}
              className={`watch-modal-video-wrapper ${isPseudoFullscreen ? 'watch-modal-video-wrapper--pseudo-fullscreen' : ''}`}
              onMouseMove={('ontouchstart' in window) || isEmbedPlayer ? undefined : () => showControlsWithDelay()}
              onMouseLeave={('ontouchstart' in window) || isEmbedPlayer ? undefined : () => isPlaying && setShowControls(false)}
              onTouchStart={isEmbedPlayer ? undefined : handleVideoWrapperTouchStart}
              onTouchEnd={isEmbedPlayer ? undefined : handleVideoWrapperTouchEnd}
            >
              {isEmbedPlayer ? (
                embedStarted ? (
                  <iframe
                    key={videoEmbed.embedUrl}
                    className="watch-modal-video watch-modal-video--embed"
                    src={videoEmbed.embedUrl}
                    title={movie?.title?.[contentLang] || movie?.title?.uz || 'Video'}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
                    allowFullScreen
                    referrerPolicy="strict-origin-when-cross-origin"
                    sandbox="allow-scripts allow-same-origin allow-presentation allow-forms allow-fullscreen"
                  />
                ) : (
                  <div className="watch-modal-embed-start">
                    {embedPoster ? (
                      <img
                        className="watch-modal-embed-poster"
                        src={embedPoster}
                        alt=""
                      />
                    ) : (
                      <div className="watch-modal-embed-poster watch-modal-embed-poster--empty" />
                    )}
                    <div className="watch-modal-controls-overlay show">
                      <div className="watch-modal-controls-center">
                        <button
                          type="button"
                          className="watch-modal-control-btn watch-modal-control-btn-play"
                          onClick={handleControlPlayClick}
                          aria-label={t('player.play')}
                        >
                          <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
                            <polygon points="5 3 19 12 5 21 5 3" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                )
              ) : (
                <>
              <video
                ref={videoRef}
                src={watchSrc}
                className="watch-modal-video"
                onLoadStart={() => setIsVideoBuffering(true)}
                onWaiting={() => setIsVideoBuffering(true)}
                onStalled={() => setIsVideoBuffering(true)}
                onSeeking={() => setIsVideoBuffering(true)}
                onPlay={() => setIsPlaying(true)}
                onPlaying={() => {
                  setIsPlaying(true);
                  setIsVideoBuffering(false);
                }}
                onPause={() => setIsPlaying(false)}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onLoadedData={() => {
                  handleLoadedMetadata();
                  setIsVideoBuffering(false);
                }}
                onCanPlay={() => {
                  handleLoadedMetadata();
                  setIsVideoBuffering(false);
                }}
                onCanPlayThrough={() => setIsVideoBuffering(false)}
                onSeeked={() => setIsVideoBuffering(false)}
                onError={() => setIsVideoBuffering(false)}
                onClick={handleVideoClick}
                onRateChange={(e) => {
                  if (e.target.playbackRate !== playbackSpeed) console.log('Rate mismatch! Expected:', playbackSpeed, 'Got:', e.target.playbackRate);
                }}
              />
              {!showAdOverlay && isVideoBuffering && (
                <VideoLoader message="Video yuklanmoqda..." />
              )}
              
              {showAdOverlay && activeAd && (
                <div className="watch-modal-ad-overlay show">
                  <video
                    ref={adVideoRef}
                    src={activeAd.videoUrl}
                    className="watch-modal-ad-video"
                    playsInline
                    onEnded={handleAdEnded}
                  />
                </div>
              )}
              <div className={`watch-modal-controls-overlay ${showControls && !showAdOverlay ? 'show' : ''}`}>
                <div className="watch-modal-controls-center">
                  <button className="watch-modal-control-btn" onClick={handleBack10} aria-label="Rewind 10 seconds">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M11.99 5V1l-5 5 5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6h-2c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>
                      <text x="8" y="15" fill="white" fontSize="8" fontWeight="bold">10</text>
                    </svg>
                  </button>
                  
                  <button className="watch-modal-control-btn watch-modal-control-btn-play" onClick={handleControlPlayClick} aria-label={isPlaying ? t('player.pause') : t('player.play')}>
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
                      {isPlaying ? (<><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></>) : (<polygon points="5 3 19 12 5 21 5 3"/>)}
                    </svg>
                  </button>
                  
                  <button className="watch-modal-control-btn" onClick={handleForward10} aria-label="Forward 10 seconds">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z"/>
                      <text x="8" y="15" fill="white" fontSize="8" fontWeight="bold">10</text>
                    </svg>
                  </button>
                </div>
              </div>

              <div className={`watch-modal-bottom-controls ${showControls && !showAdOverlay ? 'show' : ''}`}>
                <div 
                  className="watch-modal-progress-container"
                  onClick={(e) => { e.stopPropagation(); handleProgressClick(e); }}
                  onMouseDown={(e) => { e.stopPropagation(); handleProgressMouseDown(e); }}
                  onMouseMove={(e) => { e.stopPropagation(); handleProgressMouseMove(e); }}
                  onMouseUp={(e) => { e.stopPropagation(); handleProgressMouseUp(e); }}
                  onMouseLeave={(e) => { e.stopPropagation(); handleProgressMouseUp(e); }}
                  onTouchStart={(e) => { e.stopPropagation(); handleProgressTouchStart(e); }}
                  onTouchMove={(e) => { e.stopPropagation(); handleProgressTouchMove(e); }}
                  onTouchEnd={(e) => { e.stopPropagation(); handleProgressTouchEnd(e); }}
                >
                  <div className="watch-modal-progress-bar">
                    <div className="watch-modal-progress-filled" style={{ width: `${isDragging ? (previewTime / duration) * 100 : getProgressPercent()}%` }}>
                      <div className="watch-modal-progress-thumb"></div>
                    </div>
                    {isDragging && (
                      <div className="watch-modal-preview-tooltip" style={{ left: `${(previewTime / duration) * 100}%` }}>
                        {formatTime(previewTime)}
                      </div>
                    )}
                  </div>
                </div>

                <div className="watch-modal-controls-bar">
                  <div className="watch-modal-left-controls">
                    <button className="watch-modal-icon-btn" onClick={(e) => { e.stopPropagation(); handlePlayPause(); }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        {isPlaying ? (<><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></>) : (<polygon points="5 3 19 12 5 21 5 3"/>)}
                      </svg>
                    </button>

                    <button className="watch-modal-icon-btn" onClick={(e) => { e.stopPropagation(); toggleMute(); }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        {isMuted || volume === 0 ? (
                          <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
                        ) : volume > 0.5 ? (
                          <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                        ) : (
                          <path d="M7 9v6h4l5 5V4l-5 5H7z"/>
                        )}
                      </svg>
                    </button>

                    <div className="watch-modal-time-display">
                      <span className="watch-modal-time-current">{formatTime(currentTime)}</span>
                      <span className="watch-modal-time-separator"> / </span>
                      <span className="watch-modal-time-duration">{formatTime(duration)}</span>
                      <span className="watch-modal-time-remaining"> (-{formatTime(getRemainingTime())})</span>
                    </div>
                  </div>

                  <div className="watch-modal-right-controls">
                    <div style={{ position: 'relative' }}>
                      <button className="watch-modal-icon-btn" onClick={(e) => { e.stopPropagation(); setShowSpeedMenu(!showSpeedMenu); }} title={`Tezlik: ${playbackSpeed}x`}>
                        <span style={{ fontSize: '14px', fontWeight: 'bold' }}>{playbackSpeed}x</span>
                      </button>
                      {showSpeedMenu && (
                        <div className="watch-modal-speed-menu" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
                          {speedOptions.map(speed => (
                            <button
                              key={speed}
                              className={`watch-modal-speed-option ${playbackSpeed === speed ? 'active' : ''}`}
                              onClick={(e) => { e.stopPropagation(); handleSpeedChange(speed); }}
                              onMouseDown={(e) => e.stopPropagation()}
                              onTouchStart={(e) => e.stopPropagation()}
                            >
                              {speed}x
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <button className="watch-modal-icon-btn" onClick={(e) => { e.stopPropagation(); handleFullscreen(); }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        {isFullscreen ? (
                          <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/>
                        ) : (
                          <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
                        )}
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
                </>
              )}
            </div>
          </div>
          {dualWatchAvailable && (
            <div className="watch-modal-track-toggle" role="group" aria-label="Video versiyasi">
              <button
                type="button"
                className={`watch-modal-track-btn ${watchVideoTrack === 'uz' ? 'active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleWatchVideoTrackChange('uz');
                }}
              >
                UZ
              </button>
              <button
                type="button"
                className={`watch-modal-track-btn ${watchVideoTrack === 'ru' ? 'active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleWatchVideoTrackChange('ru');
                }}
              >
                RU
              </button>
            </div>
          )}

          <button className="watch-modal-close" onClick={onClose} aria-label="Back">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
            </svg>
            <span>Back</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default WatchModal;