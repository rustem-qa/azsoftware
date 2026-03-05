// ============================================
// 🎵 GLOBAL MUSIC PLAYER MODULE (WITH PROGRESS BAR & DRAG)
// ============================================

const MusicPlayer = (function() {
    // Private dəyişənlər
    let currentTrackIndex = 0;
    let isPlaying = false;
    let isExpanded = false;
    let player = null;
    let playlist = [];
    let playerReady = false;
    let pendingTrack = null;
    
    // YENI: Progress tracking
    let progressInterval = null;
    let currentDuration = 0;
    let currentTime = 0;
    
    // YENI: Drag tracking
    let isDragging = false;
    let dragOffset = { x: 0, y: 0 };
    let playerPosition = { x: 0, y: 0 }; // 0,0 means default (bottom-4 right-4)
    
    // DOM elementləri
    let container = null;
    let miniPlayer = null;
    let expandedPlayer = null;
    
    // ============================================
    // PLAYLIST MANAGEMENT
    // ============================================
    
    function loadPlaylist() {
        const saved = localStorage.getItem('azsoftware_playlist');
        if (saved) {
            playlist = JSON.parse(saved);
        } else {
            playlist = [];
        }
        return playlist;
    }
    
    function savePlaylist() {
        localStorage.setItem('azsoftware_playlist', JSON.stringify(playlist));
    }
    
    // ============================================
    // STATE SYNC (Səhifələr arası)
    // ============================================
    
    function saveState() {
        const state = {
            index: currentTrackIndex,
            isPlaying: isPlaying,
            currentTime: currentTime,
            timestamp: Date.now(),
            page: window.location.pathname,
            playerPosition: playerPosition // YENI: Pozisiyanı da saxla
        };
        localStorage.setItem('azsoftware_music_state', JSON.stringify(state));
    }
    
    function restoreState() {
        loadPlaylist();
        const saved = localStorage.getItem('azsoftware_music_state');
        
        if (saved) {
            const state = JSON.parse(saved);
            currentTrackIndex = state.index || 0;
            pendingTrack = {
                index: currentTrackIndex,
                isPlaying: state.isPlaying,
                currentTime: state.currentTime || 0
            };
            // YENI: Pozisiyanı bərpa et
            if (state.playerPosition) {
                playerPosition = state.playerPosition;
            }
        }
    }
    
    // ============================================
    // YENI: DRAG & DROP FUNCTIONS
    // ============================================
    
    function initDrag() {
        if (!container) return;
        
        // Mouse events
        container.addEventListener('mousedown', startDrag);
        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', endDrag);
        
        // Touch events
        container.addEventListener('touchstart', startDrag, { passive: false });
        document.addEventListener('touchmove', drag, { passive: false });
        document.addEventListener('touchend', endDrag);
    }
    
    function startDrag(e) {
        // Expanded açıqdırsa və expanded-in içindəki elementə kliklənibsə, drag etmə
        if (isExpanded && e.target.closest('#music-expanded')) return;
        
        // Input, button, range elementlərinə kliklənibsə drag etmə
        if (e.target.closest('input') || e.target.closest('button') || e.target.closest('.material-symbols-outlined')) return;
        
        isDragging = true;
        
        const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
        const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
        
        const rect = container.getBoundingClientRect();
        dragOffset.x = clientX - rect.left;
        dragOffset.y = clientY - rect.top;
        
        container.style.transition = 'none';
        container.style.cursor = 'grabbing';
        
        e.preventDefault();
    }
    
    function drag(e) {
        if (!isDragging) return;
        
        e.preventDefault();
        
        const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
        const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
        
        let newX = clientX - dragOffset.x;
        let newY = clientY - dragOffset.y;
        
        // Ekran sərhədlərini yoxla
        const rect = container.getBoundingClientRect();
        const maxX = window.innerWidth - rect.width;
        const maxY = window.innerHeight - rect.height;
        
        newX = Math.max(0, Math.min(newX, maxX));
        newY = Math.max(0, Math.min(newY, maxY));
        
        // Fixed pozisiyadan relative pozisiyaya çevir
        container.style.right = 'auto';
        container.style.bottom = 'auto';
        container.style.left = newX + 'px';
        container.style.top = newY + 'px';
        
        playerPosition = { x: newX, y: newY };
    }
    
    function endDrag() {
        if (!isDragging) return;
        
        isDragging = false;
        container.style.transition = 'all 0.3s';
        container.style.cursor = 'move';
        
        saveState();
    }
    
    function applySavedPosition() {
        if (!container) return;
        
        if (playerPosition.x !== 0 || playerPosition.y !== 0) {
            container.style.right = 'auto';
            container.style.bottom = 'auto';
            container.style.left = playerPosition.x + 'px';
            container.style.top = playerPosition.y + 'px';
        }
    }
    
    // ============================================
    // YOUTUBE PLAYER INTEGRATION
    // ============================================
    
    function loadYouTubeAPI() {
        if (window.YT && window.YT.Player) {
            console.log('YT API already loaded');
            initPlayer();
            return;
        }
        
        const tag = document.createElement('script');
        tag.src = "https://www.youtube.com/iframe_api ";
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
        
        window.onYouTubeIframeAPIReady = function() {
            console.log('YT API Ready callback');
            initPlayer();
        };
    }
    
    function initPlayer() {
        if (!document.getElementById('youtube-player')) {
            const playerDiv = document.createElement('div');
            playerDiv.id = 'youtube-player';
            playerDiv.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;opacity:0;';
            document.body.appendChild(playerDiv);
        }
        
        try {
            player = new YT.Player('youtube-player', {
                height: '1',
                width: '1',
                playerVars: {
                    autoplay: 0,
                    controls: 0,
                    disablekb: 1,
                    fs: 0,
                    modestbranding: 1,
                    rel: 0,
                    showinfo: 0,
                    iv_load_policy: 3,
                    playsinline: 1
                },
                events: {
                    onReady: onPlayerReady,
                    onStateChange: onPlayerStateChange,
                    onError: onPlayerError
                }
            });
        } catch (e) {
            console.error('Player init error:', e);
        }
    }
    
    function onPlayerReady(event) {
        console.log('🎵 Player Ready');
        playerReady = true;
        
        if (pendingTrack && pendingTrack.isPlaying && playlist.length > 0) {
            console.log('Resuming pending track:', pendingTrack);
            setTimeout(() => {
                loadAndPlayTrack(pendingTrack.index, pendingTrack.currentTime);
            }, 500);
        } else {
            updateUI();
        }
    }
    
    function onPlayerStateChange(event) {
        console.log('Player state:', event.data);
        
        if (event.data === YT.PlayerState.ENDED) {
            console.log('Track ended, playing next...');
            stopProgressTracking();
            playNext();
        }
        
        if (event.data === YT.PlayerState.PLAYING) {
            isPlaying = true;
            startProgressTracking();
            saveState();
        } else if (event.data === YT.PlayerState.PAUSED) {
            isPlaying = false;
            stopProgressTracking();
            saveState();
        }
        
        updatePlayButton();
        updateUI();
    }
    
    function onPlayerError(event) {
        console.error('Player Error:', event.data);
        stopProgressTracking();
        showNotification('Musiqi yüklənmədi. Növbəti track...');
        setTimeout(playNext, 2000);
    }
    
    // ============================================
    // YENI: PROGRESS TRACKING (Vaxt izləmə)
    // ============================================
    
    function startProgressTracking() {
        stopProgressTracking();
        
        progressInterval = setInterval(() => {
            if (!playerReady || !player || !player.getCurrentTime) return;
            
            try {
                currentTime = player.getCurrentTime() || 0;
                currentDuration = player.getDuration() || 0;
                
                updateProgressUI();
            } catch (e) {
                console.log('Progress tracking error:', e);
            }
        }, 1000);
    }
    
    function stopProgressTracking() {
        if (progressInterval) {
            clearInterval(progressInterval);
            progressInterval = null;
        }
    }
    
    function formatTime(seconds) {
        if (!seconds || isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    
    function updateProgressUI() {
        const progressBar = document.getElementById('music-progress-bar');
        const currentTimeEl = document.getElementById('music-current-time');
        const totalTimeEl = document.getElementById('music-total-time');
        
        if (progressBar && currentDuration > 0) {
            const percent = (currentTime / currentDuration) * 100;
            progressBar.value = percent;
            progressBar.style.background = `linear-gradient(to right, #2d328f 0%, #2d328f ${percent}%, #e5e7eb ${percent}%, #e5e7eb 100%)`;
        }
        
        if (currentTimeEl) {
            currentTimeEl.textContent = formatTime(currentTime);
        }
        
        if (totalTimeEl) {
            totalTimeEl.textContent = formatTime(currentDuration);
        }
    }
    
    function seekToPercent(percent) {
        if (!playerReady || !player || !player.seekTo || currentDuration <= 0) return;
        
        const seekTime = (percent / 100) * currentDuration;
        player.seekTo(seekTime, true);
        currentTime = seekTime;
        updateProgressUI();
        saveState();
    }
    
    // ============================================
    // CORE PLAYBACK FUNCTIONS
    // ============================================
    
    function extractVideoId(url) {
        if (!url) return null;
        
        let match = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
        if (match) return match[1];
        
        match = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
        if (match) return match[1];
        
        match = url.match(/embed\/([a-zA-Z0-9_-]{11})/);
        if (match) return match[1];
        
        match = url.match(/shorts\/([a-zA-Z0-9_-]{11})/);
        if (match) return match[1];
        
        return null;
    }
    
    function loadAndPlayTrack(index, startSeconds = 0) {
        if (!playerReady || !player || !player.loadVideoById) {
            console.log('Player not ready, saving as pending');
            pendingTrack = { index: index, isPlaying: true, currentTime: startSeconds };
            return;
        }
        
        if (playlist.length === 0) {
            showNotification('Playlist boşdur!');
            return;
        }
        
        if (index < 0) index = playlist.length - 1;
        if (index >= playlist.length) index = 0;
        
        currentTrackIndex = index;
        currentTime = startSeconds;
        
        const track = playlist[index];
        const videoId = extractVideoId(track.url);
        
        if (!videoId) {
            console.error('Invalid video ID for:', track.url);
            showNotification('Keçərsiz video linki');
            playNext();
            return;
        }
        
        console.log('🎵 Loading track:', index, track.title, 'at', startSeconds, 'seconds');
        
        try {
            stopProgressTracking();
            
            player.loadVideoById({
                videoId: videoId,
                startSeconds: startSeconds,
                suggestedQuality: 'small'
            });
            
            isPlaying = true;
            
            setTimeout(() => {
                if (player && player.getDuration) {
                    currentDuration = player.getDuration() || 0;
                    updateProgressUI();
                }
                startProgressTracking();
            }, 1000);
            
            saveState();
            updateUI();
            updatePlaylistUI();
            
        } catch (e) {
            console.error('Error loading video:', e);
        }
    }
    
    function playTrack(index) {
        loadAndPlayTrack(index, 0);
    }
    
    function togglePlay() {
        if (!playerReady || !player) {
            console.log('Player not ready');
            return;
        }
        
        const state = player.getPlayerState ? player.getPlayerState() : -1;
        console.log('Current state:', state);
        
        if (state === YT.PlayerState.PLAYING) {
            player.pauseVideo();
            isPlaying = false;
            stopProgressTracking();
        } else {
            if (state === -1 || state === YT.PlayerState.ENDED || state === YT.PlayerState.CUED) {
                if (playlist.length > 0) {
                    loadAndPlayTrack(currentTrackIndex);
                } else {
                    showNotification('Playlist boşdur!');
                }
            } else {
                player.playVideo();
                isPlaying = true;
                startProgressTracking();
            }
        }
        
        saveState();
        updateUI();
    }
    
    function playNext() {
        console.log('playNext called, current:', currentTrackIndex, 'total:', playlist.length);
        if (playlist.length === 0) return;
        
        let nextIndex = currentTrackIndex + 1;
        if (nextIndex >= playlist.length) {
            nextIndex = 0;
        }
        
        console.log('Playing next track:', nextIndex);
        loadAndPlayTrack(nextIndex, 0);
    }
    
    function playPrevious() {
        console.log('playPrevious called, current:', currentTrackIndex);
        if (playlist.length === 0) return;
        
        if (currentTime > 3) {
            console.log('Restarting current track (played > 3s)');
            loadAndPlayTrack(currentTrackIndex, 0);
            return;
        }
        
        let prevIndex = currentTrackIndex - 1;
        if (prevIndex < 0) {
            prevIndex = playlist.length - 1;
        }
        
        console.log('Playing previous track:', prevIndex);
        loadAndPlayTrack(prevIndex, 0);
    }
    
    // ============================================
    // PLAYLIST MANAGEMENT
    // ============================================
    
    function addTrack(title, url) {
        const videoId = extractVideoId(url);
        if (!videoId) {
            showNotification('Keçərsiz YouTube linki!');
            return false;
        }
        
        const exists = playlist.find(t => extractVideoId(t.url) === videoId);
        if (exists) {
            showNotification('Bu musiqi artıq playlistdə var!');
            return false;
        }
        
        playlist.push({
            title: title || 'Naməlum musiqi',
            url: url,
            addedAt: Date.now()
        });
        
        savePlaylist();
        updatePlaylistUI();
        
        if (playlist.length === 1) {
            setTimeout(() => loadAndPlayTrack(0), 500);
        }
        
        showNotification('Musiqi əlavə edildi!');
        return true;
    }
    
    function removeTrack(index) {
        if (index < 0 || index >= playlist.length) return;
        
        const wasPlaying = (index === currentTrackIndex && isPlaying);
        const removedCurrent = (index === currentTrackIndex);
        
        playlist.splice(index, 1);
        
        if (playlist.length === 0) {
            currentTrackIndex = 0;
            currentTime = 0;
            currentDuration = 0;
            stopProgressTracking();
            if (playerReady && player) player.stopVideo();
            isPlaying = false;
        } else if (removedCurrent) {
            if (currentTrackIndex >= playlist.length) {
                currentTrackIndex = 0;
            }
            if (wasPlaying && playlist.length > 0) {
                loadAndPlayTrack(currentTrackIndex);
            }
        } else if (index < currentTrackIndex) {
            currentTrackIndex--;
        }
        
        savePlaylist();
        saveState();
        updatePlaylistUI();
        updateUI();
    }
    
    // ============================================
    // UI CREATION & MANAGEMENT (WITH PROGRESS BAR)
    // ============================================
    
    function createPlayerHTML() {
        if (document.getElementById('global-music-player')) return;
        
        const html = `
            <div id="global-music-player" class="fixed bottom-4 right-4 z-[9999] font-display select-none cursor-move" style="touch-action: none;">
                <!-- Mini Player -->
                <div id="music-mini" class="bg-white rounded-2xl shadow-[0_8px_30px_rgba(45,50,143,0.3)] border border-[#2d328f]/20 p-3 cursor-pointer transition-all duration-300 hover:shadow-[0_12px_40px_rgba(45,50,143,0.4)]">
                    <div class="flex items-center gap-3 pointer-events-none">
                        <div class="w-10 h-10 rounded-full bg-gradient-to-br from-[#2d328f] to-[#1b66ea] flex items-center justify-center text-white" id="music-icon">
                            <span class="material-symbols-outlined text-lg" id="mini-icon-symbol">music_note</span>
                        </div>
                        <div class="flex-1 min-w-0">
                            <p class="text-xs text-[#666666] font-medium truncate w-32" id="mini-title">Musiqi seçin</p>
                            <p class="text-[10px] text-[#2d328f]" id="mini-status">Playlist boş</p>
                        </div>
                        <button onclick="event.stopPropagation(); MusicPlayer.togglePlay()" class="w-8 h-8 rounded-full bg-[#2d328f]/10 hover:bg-[#2d328f]/20 flex items-center justify-center text-[#2d328f] transition-all pointer-events-auto" id="mini-play-btn">
                            <span class="material-symbols-outlined text-sm">play_arrow</span>
                        </button>
                        <button onclick="event.stopPropagation(); MusicPlayer.toggleExpand()" class="w-8 h-8 rounded-full bg-[#2d328f]/10 hover:bg-[#2d328f]/20 flex items-center justify-center text-[#2d328f] transition-all pointer-events-auto">
                            <span class="material-symbols-outlined text-sm" id="expand-icon">expand_less</span>
                        </button>
                    </div>
                </div>
                
                <!-- Expanded Player -->
                <div id="music-expanded" class="hidden bg-white rounded-2xl shadow-[0_12px_40px_rgba(45,50,143,0.4)] border border-[#2d328f]/20 w-80 overflow-hidden transition-all duration-300 absolute bottom-full right-0 mb-2 max-h-[80vh] flex flex-col cursor-default">
                    <!-- Header -->
                    <div class="bg-gradient-to-r from-[#2d328f] to-[#1b66ea] px-4 py-3 text-white flex-shrink-0">
                        <div class="flex items-center justify-between">
                            <h4 class="font-semibold text-sm flex items-center gap-2">
                                <span class="material-symbols-outlined text-lg">queue_music</span>
                                Playlist (${playlist.length})
                            </h4>
                            <button onclick="MusicPlayer.toggleExpand()" class="text-white/80 hover:text-white">
                                <span class="material-symbols-outlined">expand_more</span>
                            </button>
                        </div>
                    </div>
                    
                    <!-- Now Playing -->
                    <div class="p-4 bg-[#2d328f]/5 border-b border-[#2d328f]/10 flex-shrink-0">
                        <p class="text-xs text-[#666666] mb-1">İNDİ ÇALINIR (#${currentTrackIndex + 1}/${playlist.length})</p>
                        <p class="font-medium text-[#333333] text-sm truncate mb-3" id="now-playing-title">Musiqi seçilməyib</p>
                        
                        <!-- Progress Bar Section -->
                        <div class="mb-4">
                            <div class="flex justify-between text-xs text-[#666666] mb-1">
                                <span id="music-current-time">0:00</span>
                                <span id="music-total-time">0:00</span>
                            </div>
                            <div class="relative">
                                <input 
                                    type="range" 
                                    id="music-progress-bar" 
                                    min="0" 
                                    max="100" 
                                    value="0"
                                    class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#2d328f] hover:h-3 transition-all"
                                    style="background: linear-gradient(to right, #2d328f 0%, #2d328f 0%, #e5e7eb 0%, #e5e7eb 100%);"
                                    oninput="MusicPlayer.seekToPercent(this.value)"
                                    onmousedown="MusicPlayer.startSeek()"
                                    onmouseup="MusicPlayer.endSeek()"
                                    ontouchstart="MusicPlayer.startSeek()"
                                    ontouchend="MusicPlayer.endSeek()"
                                >
                            </div>
                        </div>
                        
                        <!-- Controls -->
                        <div class="flex items-center justify-center gap-4">
                            <button onclick="MusicPlayer.playPrevious()" class="w-10 h-10 rounded-full bg-white shadow-md flex items-center justify-center text-[#2d328f] hover:bg-[#2d328f] hover:text-white transition-all active:scale-95" title="Əvvəlki (və ya başa qaytart)">
                                <span class="material-symbols-outlined">skip_previous</span>
                            </button>
                            <button onclick="MusicPlayer.togglePlay()" class="w-14 h-14 rounded-full bg-gradient-to-r from-[#2d328f] to-[#1b66ea] shadow-lg flex items-center justify-center text-white hover:shadow-xl transition-all transform hover:scale-105 active:scale-95" id="main-play-btn">
                                <span class="material-symbols-outlined text-2xl">play_arrow</span>
                            </button>
                            <button onclick="MusicPlayer.playNext()" class="w-10 h-10 rounded-full bg-white shadow-md flex items-center justify-center text-[#2d328f] hover:bg-[#2d328f] hover:text-white transition-all active:scale-95" title="Növbəti">
                                <span class="material-symbols-outlined">skip_next</span>
                            </button>
                        </div>
                    </div>
                    
                    <!-- Add Track -->
                    <div class="p-3 border-b border-gray-100 flex-shrink-0">
                        <div class="flex gap-2 mb-2">
                            <input type="text" id="track-title-input" placeholder="Musiqi adı" 
                                   class="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs focus:border-[#2d328f] focus:outline-none">
                        </div>
                        <div class="flex gap-2">
                            <input type="text" id="track-url-input" placeholder="YouTube linki" 
                                   class="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs focus:border-[#2d328f] focus:outline-none">
                            <button onclick="MusicPlayer.handleAddTrack()" class="px-3 py-2 bg-[#2d328f] text-white rounded-lg hover:bg-[#1b66ea] transition-all active:scale-95">
                                <span class="material-symbols-outlined text-sm">add</span>
                            </button>
                        </div>
                    </div>
                    
                    <!-- Playlist - Scrollable -->
                    <div class="flex-1 overflow-y-auto custom-scroll min-h-0" id="playlist-container">
                        <div class="p-4 text-center text-gray-400 text-sm">
                            <span class="material-symbols-outlined text-2xl mb-1 block">music_off</span>
                            Playlist boşdur
                        </div>
                    </div>
                    
                    <!-- Volume -->
                    <div class="p-3 border-t border-gray-100 bg-gray-50 flex-shrink-0">
                        <div class="flex items-center gap-2">
                            <span class="material-symbols-outlined text-gray-400 text-sm">volume_down</span>
                            <input type="range" min="0" max="100" value="50" 
                                   class="flex-1 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#2d328f]"
                                   oninput="MusicPlayer.setVolume(this.value)">
                            <span class="material-symbols-outlined text-gray-400 text-sm">volume_up</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        const div = document.createElement('div');
        div.innerHTML = html;
        document.body.appendChild(div.firstElementChild);
        
        container = document.getElementById('global-music-player');
        miniPlayer = document.getElementById('music-mini');
        expandedPlayer = document.getElementById('music-expanded');
        
        // YENI: Drag funksionallığını aktiv et
        initDrag();
        
        // YENI: Saxlanmış pozisiyanı tətbiq et
        applySavedPosition();
        
        miniPlayer.addEventListener('click', (e) => {
            if (!e.target.closest('button')) {
                toggleExpand();
            }
        });
    }
    
    let wasPlayingBeforeSeek = false;
    
    function startSeek() {
        wasPlayingBeforeSeek = isPlaying;
    }
    
    function endSeek() {
        // Seek bitəndə əvvəlki statusu bərpa et
    }
    
    function toggleExpand() {
        isExpanded = !isExpanded;
        const expanded = document.getElementById('music-expanded');
        const icon = document.getElementById('expand-icon');
        
        if (isExpanded) {
            expanded.classList.remove('hidden');
            icon.textContent = 'expand_more';
            updatePlaylistUI();
            updateProgressUI();
        } else {
            expanded.classList.add('hidden');
            icon.textContent = 'expand_less';
        }
    }
    
    function updateUI() {
        const miniTitle = document.getElementById('mini-title');
        const miniStatus = document.getElementById('mini-status');
        const musicIcon = document.getElementById('mini-icon-symbol');
        const nowPlaying = document.getElementById('now-playing-title');
        
        if (playlist.length > 0 && currentTrackIndex < playlist.length) {
            const track = playlist[currentTrackIndex];
            if (miniTitle) miniTitle.textContent = track.title;
            if (nowPlaying) nowPlaying.textContent = track.title;
            
            if (miniStatus) {
                if (isPlaying) {
                    miniStatus.innerHTML = '▶ <span class="animate-pulse">Çalınır</span>';
                } else {
                    miniStatus.textContent = '⏸ Dayandırılıb';
                }
            }
            
            if (musicIcon) {
                musicIcon.textContent = isPlaying ? 'graphic_eq' : 'music_note';
            }
        } else {
            if (miniTitle) miniTitle.textContent = 'Musiqi seçin';
            if (miniStatus) miniStatus.textContent = 'Playlist boş';
            if (nowPlaying) nowPlaying.textContent = 'Musiqi seçilməyib';
        }
        
        updatePlayButton();
    }
    
    function updatePlayButton() {
        const miniBtn = document.getElementById('mini-play-btn');
        const mainBtn = document.getElementById('main-play-btn');
        
        const icon = isPlaying ? 'pause' : 'play_arrow';
        
        if (miniBtn) {
            miniBtn.innerHTML = `<span class="material-symbols-outlined text-sm">${icon}</span>`;
        }
        if (mainBtn) {
            mainBtn.innerHTML = `<span class="material-symbols-outlined text-2xl">${icon}</span>`;
        }
    }
    
    function updatePlaylistUI() {
        const container = document.getElementById('playlist-container');
        if (!container) return;
        
        const headerTitle = document.querySelector('#music-expanded h4');
        if (headerTitle) {
            headerTitle.innerHTML = `<span class="material-symbols-outlined text-lg">queue_music</span> Playlist (${playlist.length})`;
        }
        
        const nowPlayingNum = document.querySelector('#music-expanded .text-xs.text-\\[\\#666666\\]');
        if (nowPlayingNum) {
            nowPlayingNum.textContent = `İNDİ ÇALINIR (#${currentTrackIndex + 1}/${playlist.length})`;
        }
        
        if (playlist.length === 0) {
            container.innerHTML = `
                <div class="p-4 text-center text-gray-400 text-sm">
                    <span class="material-symbols-outlined text-2xl mb-1 block">music_off</span>
                    Playlist boşdur
                </div>
            `;
            updateProgressUI();
            return;
        }
        
        let html = '';
        playlist.forEach((track, index) => {
            const isCurrent = index === currentTrackIndex;
            const isPlayingClass = isCurrent ? 'bg-[#2d328f]/10 border-l-4 border-[#2d328f]' : 'hover:bg-gray-50 border-l-4 border-transparent';
            const playingIcon = isCurrent && isPlaying ? 
                '<span class="material-symbols-outlined text-[#2d328f] animate-pulse text-sm">volume_up</span>' : 
                `<span class="text-gray-400 text-xs w-5 text-center">${index + 1}</span>`;
            
            html += `
                <div class="flex items-center gap-3 p-3 border-b border-gray-50 ${isPlayingClass} cursor-pointer group transition-all" 
                     onclick="MusicPlayer.playTrack(${index})">
                    <div class="flex-shrink-0 w-5 flex justify-center">${playingIcon}</div>
                    <div class="flex-1 min-w-0">
                        <p class="text-sm text-[#333333] truncate ${isCurrent ? 'font-medium' : ''}">${track.title}</p>
                    </div>
                    <button onclick="event.stopPropagation(); MusicPlayer.removeTrack(${index})" 
                            class="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-all p-1 hover:bg-red-50 rounded">
                        <span class="material-symbols-outlined text-sm">close</span>
                    </button>
                </div>
            `;
        });
        
        container.innerHTML = html;
        
        if (isExpanded) {
            const currentEl = container.querySelector('.bg-\\[\\#2d328f\\]\\/10');
            if (currentEl) {
                currentEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }
    }
    
    function handleAddTrack() {
        const titleInput = document.getElementById('track-title-input');
        const urlInput = document.getElementById('track-url-input');
        
        const title = titleInput.value.trim();
        const url = urlInput.value.trim();
        
        if (!url) {
            showNotification('YouTube linki daxil edin!');
            return;
        }
        
        if (addTrack(title || 'Naməlum musiqi', url)) {
            titleInput.value = '';
            urlInput.value = '';
        }
    }
    
    function setVolume(value) {
        if (playerReady && player && player.setVolume) {
            player.setVolume(value);
        }
    }
    
    function showNotification(message) {
        const notif = document.createElement('div');
        notif.className = 'fixed top-20 right-4 bg-[#2d328f] text-white px-4 py-2 rounded-lg shadow-lg z-[10000] animate-slideIn text-sm';
        notif.textContent = message;
        document.body.appendChild(notif);
        setTimeout(() => notif.remove(), 3000);
    }
    
    // ============================================
    // PUBLIC API
    // ============================================
    
    return {
        init: function() {
            console.log('🎵 MusicPlayer.init() called');
            createPlayerHTML();
            restoreState();
            loadYouTubeAPI();
            
            window.addEventListener('beforeunload', function() {
                saveState();
            });
            
            setInterval(saveState, 5000);
            
            console.log('🎵 Music Player initialized');
        },
        
        // Core controls
        togglePlay: togglePlay,
        playTrack: playTrack,
        playNext: playNext,
        playPrevious: playPrevious,
        
        // Progress controls
        seekToPercent: seekToPercent,
        startSeek: startSeek,
        endSeek: endSeek,
        
        // UI
        toggleExpand: toggleExpand,
        handleAddTrack: handleAddTrack,
        setVolume: setVolume,
        
        // Playlist
        addTrack: addTrack,
        removeTrack: removeTrack,
        
        // Debug
        getPlaylist: () => playlist,
        getCurrentIndex: () => currentTrackIndex,
        isPlayerReady: () => playerReady,
        getPlayer: () => player,
        getCurrentTime: () => currentTime,
        getDuration: () => currentDuration
    };
})();

window.MusicPlayer = MusicPlayer;