document.addEventListener("DOMContentLoaded", (event) => {
    window.player = new Artplayer({
        container: '#container',
        url: url,
        autoplay: true,
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
            m3u8: function (video, url) {
                if (Hls.isSupported()) {
                    if (window.player.hls) window.player.hls.destroy();
                    const hls = new Hls();
                    hls.loadSource(url);
                    hls.attachMedia(video);
                    window.player.hls = hls;
                    window.player.on('destroy', () => hls.destroy());
                } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                    video.src = url;
                } else {
                    window.player.notice.show = 'Unsupported playback format: m3u8';
                }
            },
        }
    });

    window.video_hash = resumeKey;
    if(window.video_hash == '') window.video_hash = location.href.split('/').slice(-2).shift();
    window.player.on('video:progress', (event) => {
        if (!window.player.currentTime) { return }
        localStorage.setItem(window.video_hash, window.player.currentTime)
    })
    window.player.on('ready', () => {
        window.player.contextmenu.remove('version')

        var progress = parseFloat(localStorage.getItem(window.video_hash))
        if (isNaN(progress)) {
            progress = 0
        }
        window.player.seek = progress
    })


});
