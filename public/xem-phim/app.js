/* ===== Xem Phim — ArtPlayer + hls.js giống C:\Users\Admin\frontend-players\artplayer\share.js ===== */

const API_BASE = 'https://ophim1.com/v1/api';
const CDN_IMAGE = 'https://img.ophim.live/uploads/movies';

async function fetchPhimDetail(slug) {
    const proxyUrl = `/api/ophim-phim?slug=${encodeURIComponent(slug)}`;
    try {
        const res = await fetch(proxyUrl);
        if (res.ok) return await res.json();
    } catch (_) {}
    try {
        const res = await fetch(`${API_BASE}/phim/${slug}`, { mode: 'cors' });
        if (res.ok) return await res.json();
    } catch (_) {}
    const corsProxy = 'https://corsproxy.io/?';
    const res = await fetch(corsProxy + encodeURIComponent(`${API_BASE}/phim/${slug}`));
    if (!res.ok) throw new Error('Không thể tải dữ liệu. Vui lòng mở qua trang chủ.');
    return await res.json();
}

function imageUrl(path) {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    return `${CDN_IMAGE}/${path}`;
}

const IMG_PLACEHOLDER =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 300'%3E%3Crect fill='%23333' width='200' height='300'/%3E%3Ctext x='100' y='150' fill='%23666' text-anchor='middle' dominant-baseline='middle' font-size='14'%3ENo image%3C/text%3E%3C/svg%3E";

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
}

function setNoStreamText(message) {
    const noStream = document.getElementById('playerNoStream');
    const p = noStream && noStream.querySelector('p');
    if (p) p.textContent = message;
}

function destroyPlayer() {
    if (window._ophimArtPlayer) {
        try {
            window._ophimArtPlayer.destroy(true);
        } catch (_) {
            try {
                window._ophimArtPlayer.destroy();
            } catch (_) {}
        }
        window._ophimArtPlayer = null;
    }
}

function bindEpisodeWheelNavigation(container) {
    if (!container) return;
    container.onwheel = null;
}

/* Khóa resume localStorage, cùng ý tưởng video_hash / resumeKey trong share.js */
function getResumeKey(movie, ep, movieSlug) {
    const m = movie?.slug || movieSlug || 'movie';
    const e = ep?.slug || String(ep?.name || 'tap').replace(/\s+/g, '-').toLowerCase();
    return `ophim-pos-${m}-${e}`;
}

/* Cấu hình trùng frontend-players/artplayer/share.js */
function playEpisode(ep, movie, movieSlug) {
    const wrapper = document.getElementById('playerWrapper');
    const noStream = document.getElementById('playerNoStream');
    if (!wrapper || !noStream) return;

    const Player = window.Artplayer;
    if (typeof Player !== 'function') {
        wrapper.style.display = 'none';
        setNoStreamText('Không tải được ArtPlayer (frontend-players).');
        noStream.style.display = 'flex';
        return;
    }

    const raw = (ep && ep.link_m3u8 && String(ep.link_m3u8).trim()) || '';
    const url = raw.replace(/^http:\/\//i, 'https://');

    destroyPlayer();
    wrapper.innerHTML = '';

    const validUrl = raw && /^https?:\/\//i.test(raw);
    if (!validUrl) {
        wrapper.style.display = 'none';
        setNoStreamText('Không có luồng HLS (m3u8) cho tập này.');
        noStream.style.display = 'flex';
        return;
    }

    if (typeof Hls === 'undefined') {
        wrapper.style.display = 'none';
        setNoStreamText('Không tải được hls.js (frontend-players/js/hls.js).');
        noStream.style.display = 'flex';
        return;
    }

    const poster = imageUrl(movie?.poster_url || movie?.thumb_url || '');
    const resumeKey = getResumeKey(movie, ep, movieSlug);

    wrapper.innerHTML = '<div id="ophimArtRoot" class="ophim-art-root"></div>';
    wrapper.style.display = 'block';
    noStream.style.display = 'none';

    const showFatal = (msg) => {
        try {
            if (window._ophimArtPlayer) {
                window._ophimArtPlayer.destroy(true);
                window._ophimArtPlayer = null;
            }
        } catch (_) {}
        wrapper.innerHTML = '';
        wrapper.style.display = 'none';
        setNoStreamText(msg);
        noStream.style.display = 'flex';
    };

    try {
        const art = new Player({
            container: '#ophimArtRoot',
            url,
            type: 'm3u8',
            poster: poster || undefined,
            autoplay: false,
            autoSize: false,
            loop: false,
            mutex: true,
            setting: true,
            pip: true,
            flip: false,
            lock: true,
            fastForward: true,
            playbackRate: true,
            aspectRatio: true,
            theme: '#ff0057',
            fullscreen: true,
            fullscreenWeb: false,
            miniProgressBar: true,
            autoOrientation: true,
            airplay: false,
            whitelist: ['*'],
            customType: {
                m3u8(video, src, artInstance) {
                    if (Hls.isSupported()) {
                        if (artInstance.hls) artInstance.hls.destroy();
                        const hls = new Hls();
                        hls.loadSource(src);
                        hls.attachMedia(video);
                        artInstance.hls = hls;
                        hls.on(Hls.Events.ERROR, (_, data) => {
                            if (!data.fatal) return;
                            if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad();
                            else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
                            else {
                                showFatal(
                                    'Không phát được luồng (CORS hoặc lỗi máy chủ). Thử server hoặc tập khác.',
                                );
                            }
                        });
                        artInstance.on('destroy', () => {
                            try {
                                hls.destroy();
                            } catch (_) {}
                            artInstance.hls = null;
                        });
                    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                        video.src = src;
                    } else {
                        artInstance.notice.show = 'Unsupported playback format: m3u8';
                    }
                },
            },
        });

        window._ophimArtPlayer = art;

        art.on('video:progress', () => {
            if (!art.currentTime) return;
            localStorage.setItem(resumeKey, String(art.currentTime));
        });

        art.on('ready', () => {
            try {
                art.contextmenu.remove('version');
            } catch (_) {}

            let progress = parseFloat(localStorage.getItem(resumeKey));
            if (isNaN(progress)) progress = 0;
            if (progress > 0 && typeof art.seek === 'function') {
                art.seek(progress);
            }
        });
    } catch (_) {
        showFatal('Không khởi tạo được trình phát.');
    }
}

async function showMovieDetail(slug) {
    const noSlugEl = document.getElementById('noSlug');
    const detailEl = document.getElementById('movieDetail');
    if (noSlugEl) noSlugEl.style.display = 'none';
    detailEl.classList.add('active');
    detailEl.style.display = 'block';
    const content = document.getElementById('detailContent');
    content.innerHTML = '<div class="loading">Đang tải thông tin phim...</div>';

    try {
        const data = await fetchPhimDetail(slug);
        if (data.status !== 'success' || !data.data?.item) {
            throw new Error('Không tìm thấy phim');
        }

        const movie = data.data.item;
        const episodes = movie.episodes || [];
        const firstEp = episodes[0]?.server_data?.[0];

        content.innerHTML = `
            <div class="detail-header">
                <div class="poster-with-action">
                    <div class="detail-poster">
                        <img src="${imageUrl(movie.poster_url || movie.thumb_url)}" alt="${escapeHtml(movie.name)}"
                             onerror="this.src='${IMG_PLACEHOLDER}'">
                    </div>
                    <button type="button" class="btn-xem-ngay" id="btnXemNgay">
                        <span class="btn-xem-icon">▶</span> Xem ngay
                    </button>
                </div>
                <div class="detail-info">
                    <h2>${escapeHtml(movie.name)}</h2>
                    ${movie.origin_name ? `<p style="color:rgba(255,255,255,0.7);margin-bottom:12px;">${escapeHtml(movie.origin_name)}</p>` : ''}
                    <div class="detail-meta">
                        <span>📅 ${movie.year || 'N/A'}</span>
                        <span>⏱ ${movie.time || ''}</span>
                        <span>📺 ${movie.episode_current || ''}</span>
                        <span>🎬 ${movie.quality || ''}</span>
                        <span>🌐 ${movie.lang || ''}</span>
                        ${movie.country?.length ? `<span>📍 ${movie.country.map((c) => c.name).join(', ')}</span>` : ''}
                    </div>
                </div>
            </div>
            <div class="player-modal" id="playerModal">
                <div class="player-modal-backdrop" id="playerModalBackdrop"></div>
                <div class="player-modal-content">
                    <button type="button" class="player-modal-close" id="playerModalClose" aria-label="Đóng">×</button>
                    <div class="player-section">
                        <div id="playerWrapper" class="player-wrapper" style="display:none"></div>
                        <div id="playerNoStream" class="player-no-stream" style="display:none" role="status">
                            <p>Không có luồng HLS (m3u8) cho tập này.</p>
                        </div>
                        ${episodes.length ? `
                        <div class="player-controls">
                            <div class="player-controls-section">
                                <div class="player-controls-heading">
                                    <span class="player-controls-title">Server phát</span>
                                </div>
                                <div class="server-tabs" id="serverTabs"></div>
                            </div>
                            <div class="player-controls-section episode-section">
                                <div class="episode-section-header">
                                    <span class="episode-section-title">TẬP PHIM</span>
                                    <span class="episode-section-subtitle" id="episodesServerLabel">VIETSUB</span>
                                </div>
                                <div class="episode-section-divider">
                                    <span class="episode-section-divider-active"></span>
                                </div>
                                <div class="episodes" id="episodesList"></div>
                                <div class="episode-section-current" id="currentEpisodeLabel"></div>
                            </div>
                        </div>
                        ` : ''}
                    </div>
                </div>
            </div>
            ${movie.content ? `
            <div class="content-block">
                <h3>Nội dung</h3>
                <p>${movie.content.replace(/\n/g, '<br>')}</p>
            </div>
            ` : ''}
        `;

        if (episodes.length) {
            const serverTabs = document.getElementById('serverTabs');
            const episodesList = document.getElementById('episodesList');
            const episodesServerLabel = document.getElementById('episodesServerLabel');
            const currentEpisodeLabel = document.getElementById('currentEpisodeLabel');
            let activeServerIndex = 0;

            function syncServerTabs() {
                document.querySelectorAll('.server-tab').forEach((tab, index) => {
                    tab.classList.toggle('active', index === activeServerIndex);
                });
            }

            function updateEpisodeMeta(episodeName) {
                if (episodesServerLabel) {
                    episodesServerLabel.textContent = (episodes[activeServerIndex]?.server_name || 'VIETSUB').toUpperCase();
                }
                if (currentEpisodeLabel) {
                    currentEpisodeLabel.textContent = episodeName ? `Đang chọn: ${episodeName}` : '';
                }
            }

            episodes.forEach((server, i) => {
                const tab = document.createElement('button');
                tab.type = 'button';
                tab.className = `server-tab ${i === 0 ? 'active' : ''}`;
                tab.textContent = server.server_name;
                tab.onclick = () => {
                    activeServerIndex = i;
                    syncServerTabs();
                    renderEpisodes(episodes[i].server_data, episodesList);
                };
                serverTabs.appendChild(tab);
            });

            function renderEpisodes(serverData, el) {
                el.innerHTML = '';
                const orderedEpisodes = [...(serverData || [])].reverse();

                orderedEpisodes.forEach((ep) => {
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'ep-btn';
                    btn.textContent = ep.name;
                    btn.onclick = () => {
                        document.querySelectorAll('.ep-btn').forEach((b) => b.classList.remove('active'));
                        btn.classList.add('active');
                        updateEpisodeMeta(ep.name);
                        playEpisode(ep, movie, slug);
                    };
                    el.appendChild(btn);
                });

                bindEpisodeWheelNavigation(el);

                const first = (serverData || [])[0];
                if (first) {
                    const activeButton = Array.from(el.querySelectorAll('.ep-btn')).find(
                        (button) => button.textContent === first.name,
                    );
                    if (activeButton) activeButton.classList.add('active');
                    updateEpisodeMeta(first.name);
                    playEpisode(first, movie, slug);
                }
            }

            renderEpisodes(episodes[0].server_data, episodesList);
        } else if (firstEp) {
            playEpisode(firstEp, movie, slug);
        }

        const btnXemNgay = document.getElementById('btnXemNgay');
        const playerModal = document.getElementById('playerModal');
        const playerModalBackdrop = document.getElementById('playerModalBackdrop');
        const playerModalClose = document.getElementById('playerModalClose');
        if (btnXemNgay && playerModal) {
            btnXemNgay.addEventListener('click', () => {
                playerModal.classList.add('show');
                document.body.style.overflow = 'hidden';
            });
        }

        function closePlayerModal() {
            destroyPlayer();
            const wrap = document.getElementById('playerWrapper');
            if (wrap) wrap.innerHTML = '';
            if (playerModal) {
                playerModal.classList.remove('show');
                document.body.style.overflow = '';
            }
        }

        if (playerModalBackdrop) playerModalBackdrop.addEventListener('click', closePlayerModal);
        if (playerModalClose) playerModalClose.addEventListener('click', closePlayerModal);
        document.addEventListener('keydown', function onEsc(e) {
            if (e.key === 'Escape' && playerModal?.classList.contains('show')) {
                closePlayerModal();
            }
        });
    } catch (err) {
        content.innerHTML = `<div class="error">${escapeHtml(err.message)}</div>`;
    }
}

function getSlugFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('slug') || '';
}

function init() {
    const slugFromUrl = getSlugFromUrl();
    if (slugFromUrl) {
        showMovieDetail(slugFromUrl);
    } else {
        document.getElementById('noSlug').style.display = 'block';
        document.getElementById('movieDetail').style.display = 'none';
    }
}

document.addEventListener('DOMContentLoaded', init);
