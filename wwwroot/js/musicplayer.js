// ============================================
// 8-BIT MUSIC SYNTHESIZER & PLAYER
// ============================================

// Note frequencies
const NOTE = {
    C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.00, A3: 220.00, B3: 246.94,
    C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.00, A4: 440.00, B4: 493.88,
    C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.00, B5: 987.77,
    C6: 1046.50,
    // Sharps/Flats
    Cs3: 138.59, Ds3: 155.56, Fs3: 185.00, Gs3: 207.65, As3: 233.08,
    Cs4: 277.18, Ds4: 311.13, Fs4: 369.99, Gs4: 415.30, As4: 466.16,
    Cs5: 554.37, Ds5: 622.25, Fs5: 739.99, Gs5: 830.61, As5: 932.33,
    Bb3: 233.08, Bb4: 466.16, Bb5: 932.33,
    Eb4: 311.13, Eb5: 622.25,
    Ab4: 415.30, Ab5: 830.61
};

// Songs Data - Empty (no songs loaded)
const CHRISTMAS_SONGS = [];

const MusicPlayer = {
    audioContext: null,
    masterGain: null,
    analyser: null,
    analyserData: null,
    isPlaying: false,
    isExpanded: false,
    currentTrackIndex: 0,
    shuffle: false,
    repeat: false,
    volume: 0.7,
    currentTime: 0,
    duration: 0,
    animationFrame: null,
    waveformData: new Array(30).fill(0),
    frequencyData: new Array(64).fill(0),
    songTimeout: null,
    noteTimeouts: [],
    startTime: 0,
    activeOscillators: [],
    initialized: false,

    playlist: CHRISTMAS_SONGS.map(song => ({
        title: song.title,
        artist: song.artist,
        duration: song.duration,
        data: song
    })),

    elements: {},

    // Save state to sessionStorage for persistence across page transitions
    saveState() {
        const state = {
            trackIndex: this.currentTrackIndex,
            currentTime: this.currentTime,
            isPlaying: this.isPlaying,
            volume: this.volume,
            shuffle: this.shuffle,
            repeat: this.repeat,
            timestamp: Date.now()
        };
        sessionStorage.setItem('musicPlayerState', JSON.stringify(state));
    },

    // Load state from sessionStorage
    loadState() {
        try {
            const saved = sessionStorage.getItem('musicPlayerState');
            if (saved) {
                const state = JSON.parse(saved);
                // Restore if saved within 60 seconds (page transition)
                if (Date.now() - state.timestamp < 60000) {
                    return state;
                }
            }
        } catch (e) {}
        return null;
    },

    init() {
        if (this.initialized) return;

        // Check if elements exist
        if (!document.getElementById('musicPlayer')) return;

        this.initialized = true;
        this.cacheElements();
        this.bindEvents();
        this.renderPlaylist();
        this.startWaveformAnimation();
        this.createPlayerSnow();

        // Check for saved state from page transition
        const savedState = this.loadState();
        if (savedState) {
            this.currentTrackIndex = savedState.trackIndex;
            this.currentTime = savedState.currentTime;
            this.volume = savedState.volume;
            this.shuffle = savedState.shuffle;
            this.repeat = savedState.repeat;
            if (this.elements.volumeSlider) this.elements.volumeSlider.value = this.volume * 100;
            if (this.elements.shuffleBtn) this.elements.shuffleBtn.classList.toggle('active', this.shuffle);
            if (this.elements.repeatBtn) this.elements.repeatBtn.classList.toggle('active', this.repeat);
        }

        this.updateUI();
        if (this.playlist.length > 0) {
            this.loadTrack(this.currentTrackIndex);
        }

        // Save state before page unload
        window.addEventListener('beforeunload', () => this.saveState());

        // If was playing, auto-resume after user interaction
        if (savedState && savedState.isPlaying) {
            this.pendingAutoResume = true;
        }
    },

    createPlayerSnow() {
        const container = document.getElementById('playerSnowContainer');
        if (!container || container.children.length > 0) return;

        const snowflakeCount = 30;
        for (let i = 0; i < snowflakeCount; i++) {
            const snowflake = document.createElement('div');
            snowflake.className = 'player-snowflake';

            const size = Math.random() * 4 + 2;
            const left = Math.random() * 100;
            const duration = Math.random() * 8 + 6;
            const delay = Math.random() * 10;

            snowflake.style.cssText = `
                width: ${size}px;
                height: ${size}px;
                left: ${left}%;
                animation-duration: ${duration}s;
                animation-delay: -${delay}s;
            `;

            container.appendChild(snowflake);
        }
    },

    initAudio() {
        if (this.audioContext) return;
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

        // Create analyser for real frequency visualization
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 256;
        this.analyser.smoothingTimeConstant = 0.7;
        this.analyserData = new Uint8Array(this.analyser.frequencyBinCount);

        // Create master gain and connect through analyser
        this.masterGain = this.audioContext.createGain();
        this.masterGain.gain.value = this.volume;
        this.masterGain.connect(this.analyser);
        this.analyser.connect(this.audioContext.destination);
    },

    cacheElements() {
        this.elements = {
            playerMinimized: document.getElementById('playerMinimized'),
            playerExpanded: document.getElementById('playerExpanded'),
            expandBtn: document.getElementById('expandBtn'),
            collapseBtn: document.getElementById('collapseBtn'),
            playBtnMini: document.getElementById('playBtnMini'),
            playBtn: document.getElementById('playBtn'),
            prevBtnMini: document.getElementById('prevBtnMini'),
            prevBtn: document.getElementById('prevBtn'),
            nextBtnMini: document.getElementById('nextBtnMini'),
            nextBtn: document.getElementById('nextBtn'),
            shuffleBtn: document.getElementById('shuffleBtn'),
            repeatBtn: document.getElementById('repeatBtn'),
            volumeSlider: document.getElementById('volumeSlider'),
            progressBar: document.getElementById('progressBar'),
            progressFill: document.getElementById('progressFill'),
            trackNameMini: document.getElementById('trackNameMini'),
            trackName: document.getElementById('trackName'),
            trackArtist: document.getElementById('trackArtist'),
            timeCurrent: document.getElementById('timeCurrent'),
            timeTotal: document.getElementById('timeTotal'),
            trackCount: document.getElementById('trackCount'),
            playlistTracks: document.getElementById('playlistTracks'),
            waveformCanvas: document.getElementById('waveformCanvas'),
            visualizerCanvas: document.getElementById('visualizerCanvas')
        };
    },

    bindEvents() {
        if (this.elements.expandBtn) this.elements.expandBtn.addEventListener('click', () => this.toggleExpanded(true));
        if (this.elements.collapseBtn) this.elements.collapseBtn.addEventListener('click', () => this.toggleExpanded(false));
        if (this.elements.playBtnMini) this.elements.playBtnMini.addEventListener('click', () => this.togglePlay());
        if (this.elements.playBtn) this.elements.playBtn.addEventListener('click', () => this.togglePlay());
        if (this.elements.prevBtnMini) this.elements.prevBtnMini.addEventListener('click', () => this.previousTrack());
        if (this.elements.prevBtn) this.elements.prevBtn.addEventListener('click', () => this.previousTrack());
        if (this.elements.nextBtnMini) this.elements.nextBtnMini.addEventListener('click', () => this.nextTrack());
        if (this.elements.nextBtn) this.elements.nextBtn.addEventListener('click', () => this.nextTrack());
        if (this.elements.shuffleBtn) this.elements.shuffleBtn.addEventListener('click', () => this.toggleShuffle());
        if (this.elements.repeatBtn) this.elements.repeatBtn.addEventListener('click', () => this.toggleRepeat());
        if (this.elements.volumeSlider) {
            this.elements.volumeSlider.addEventListener('input', (e) => {
                this.volume = e.target.value / 100;
                if (this.masterGain) this.masterGain.gain.value = this.volume;
            });
        }
        if (this.elements.progressBar) {
            this.elements.progressBar.addEventListener('click', (e) => {
                const rect = this.elements.progressBar.getBoundingClientRect();
                const percent = (e.clientX - rect.left) / rect.width;
                this.seekTo(percent);
            });
        }
    },

    toggleExpanded(expanded) {
        this.isExpanded = expanded;
        if (this.elements.playerMinimized) this.elements.playerMinimized.style.display = expanded ? 'none' : 'flex';
        if (this.elements.playerExpanded) this.elements.playerExpanded.style.display = expanded ? 'block' : 'none';
    },

    togglePlay() {
        this.initAudio();
        if (this.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    },

    play() {
        if (this.playlist.length === 0) return;
        this.initAudio(); // Ensure audio context exists
        this.isPlaying = true;
        this.updatePlayButtons();
        this.startTime = Date.now() - (this.currentTime * 1000);
        this.playSong(this.playlist[this.currentTrackIndex].data);
        this.startProgressUpdate();
        this.saveState(); // Save state immediately when starting
    },

    pause() {
        this.isPlaying = false;
        this.updatePlayButtons();
        this.stopAllNotes();
        if (this.songTimeout) clearTimeout(this.songTimeout);
        this.noteTimeouts.forEach(t => clearTimeout(t));
        this.noteTimeouts = [];
        this.saveState(); // Save state when pausing
    },

    stopAllNotes() {
        // Notes naturally decay, just clear timeouts
    },

    playNote(freq, duration, startTime, type = 'square', isHarmony = false) {
        if (!this.audioContext || !this.isPlaying) return;

        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();

        osc.type = type;
        osc.frequency.value = freq;

        if (isHarmony) {
            osc.detune.value = 5;
        }

        const vol = isHarmony ? 0.08 : 0.12;
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(vol, startTime + 0.01);
        gain.gain.setValueAtTime(vol * 0.8, startTime + duration * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration * 0.95);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(startTime);
        osc.stop(startTime + duration);

        this.activeFrequencies.push({ freq, endTime: startTime + duration });
    },

    playBass(freq, duration, startTime) {
        if (!this.audioContext || !this.isPlaying) return;

        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();

        osc.type = 'triangle';
        osc.frequency.value = freq;

        gain.gain.setValueAtTime(0.15, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration * 0.9);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(startTime);
        osc.stop(startTime + duration);
    },

    playDrum(startTime, isKick) {
        if (!this.audioContext || !this.isPlaying) return;

        const bufferSize = this.audioContext.sampleRate * 0.05;
        const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
        }

        const noise = this.audioContext.createBufferSource();
        noise.buffer = buffer;

        const filter = this.audioContext.createBiquadFilter();
        filter.type = isKick ? 'lowpass' : 'highpass';
        filter.frequency.value = isKick ? 150 : 5000;

        const gain = this.audioContext.createGain();
        gain.gain.value = isKick ? 0.12 : 0.05;

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        noise.start(startTime);
        noise.stop(startTime + 0.05);
    },

    playSong(song) {
        if (!this.audioContext) return;

        const bpm = song.bpm;
        const beatDuration = 60 / bpm;
        const now = this.audioContext.currentTime;

        let melodyTime = now + 0.1;

        song.melody.forEach(([note, dur]) => {
            const freq = NOTE[note];
            if (freq) {
                const duration = dur * beatDuration;
                const timeout = setTimeout(() => {
                    if (this.isPlaying) {
                        this.playNote(freq, duration * 0.9, this.audioContext.currentTime, 'square', false);
                        this.playNote(freq * 0.8, duration * 0.85, this.audioContext.currentTime, 'square', true);
                    }
                }, (melodyTime - now) * 1000);
                this.noteTimeouts.push(timeout);
                melodyTime += duration;
            }
        });

        let bassTime = now + 0.1;
        const bassNoteDur = beatDuration;
        song.bass.forEach((note) => {
            const freq = NOTE[note];
            if (freq) {
                const timeout = setTimeout(() => {
                    if (this.isPlaying) {
                        this.playBass(freq, bassNoteDur * 0.9, this.audioContext.currentTime);
                    }
                }, (bassTime - now) * 1000);
                this.noteTimeouts.push(timeout);
            }
            bassTime += bassNoteDur;
        });

        let drumTime = now + 0.1;
        const songLength = song.duration;
        const drumCount = Math.floor(songLength / (beatDuration / 2));
        for (let i = 0; i < drumCount; i++) {
            const timeout = setTimeout(() => {
                if (this.isPlaying) {
                    if (i % 4 === 0) this.playDrum(this.audioContext.currentTime, true);
                    if (i % 4 === 2) this.playDrum(this.audioContext.currentTime, false);
                }
            }, (drumTime - now) * 1000);
            this.noteTimeouts.push(timeout);
            drumTime += beatDuration / 2;
        }

        this.songTimeout = setTimeout(() => {
            if (this.isPlaying) {
                if (this.repeat && !this.shuffle) {
                    this.currentTime = 0;
                    this.playSong(song);
                } else {
                    this.nextTrack();
                    if (this.isPlaying) {
                        this.playSong(this.playlist[this.currentTrackIndex].data);
                    }
                }
            }
        }, song.duration * 1000);
    },

    startProgressUpdate() {
        const update = () => {
            if (this.isPlaying) {
                this.currentTime = (Date.now() - this.startTime) / 1000;
                if (this.currentTime > this.duration) {
                    this.currentTime = this.duration;
                }
                this.updateProgress();
                requestAnimationFrame(update);
            }
        };
        update();
    },

    updatePlayButtons() {
        const playIcons = document.querySelectorAll('.play-icon');
        const pauseIcons = document.querySelectorAll('.pause-icon');
        playIcons.forEach(icon => icon.style.display = this.isPlaying ? 'none' : 'block');
        pauseIcons.forEach(icon => icon.style.display = this.isPlaying ? 'block' : 'none');
    },

    previousTrack() {
        this.pause();
        this.currentTrackIndex = (this.currentTrackIndex - 1 + this.playlist.length) % this.playlist.length;
        this.loadTrack(this.currentTrackIndex);
        this.currentTime = 0;
        this.play();
    },

    nextTrack() {
        this.pause();
        if (this.shuffle) {
            this.currentTrackIndex = Math.floor(Math.random() * this.playlist.length);
        } else {
            this.currentTrackIndex = (this.currentTrackIndex + 1) % this.playlist.length;
        }
        this.loadTrack(this.currentTrackIndex);
        this.currentTime = 0;
        if (this.isPlaying) {
            this.play();
        }
    },

    loadTrack(index) {
        const track = this.playlist[index];
        if (this.elements.trackNameMini) this.elements.trackNameMini.textContent = track.title;
        if (this.elements.trackName) this.elements.trackName.textContent = track.title;
        if (this.elements.trackArtist) this.elements.trackArtist.textContent = track.artist;
        if (this.elements.timeTotal) this.elements.timeTotal.textContent = this.formatTime(track.duration);
        this.currentTime = 0;
        this.duration = track.duration;
        this.updateProgress();
        this.updatePlaylistUI();
    },

    toggleShuffle() {
        this.shuffle = !this.shuffle;
        if (this.elements.shuffleBtn) this.elements.shuffleBtn.classList.toggle('active', this.shuffle);
    },

    toggleRepeat() {
        this.repeat = !this.repeat;
        if (this.elements.repeatBtn) this.elements.repeatBtn.classList.toggle('active', this.repeat);
    },

    seekTo(percent) {
        this.pause();
        this.currentTime = 0;
        this.play();
    },

    updateProgress() {
        const percent = this.duration > 0 ? (this.currentTime / this.duration) * 100 : 0;
        if (this.elements.progressFill) this.elements.progressFill.style.width = `${Math.min(percent, 100)}%`;
        if (this.elements.timeCurrent) this.elements.timeCurrent.textContent = this.formatTime(this.currentTime);
    },

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    },

    renderPlaylist() {
        if (!this.elements.trackCount || !this.elements.playlistTracks) return;

        this.elements.trackCount.textContent = `${this.playlist.length} tracks`;
        this.elements.playlistTracks.innerHTML = this.playlist.map((track, index) => `
            <div class="playlist-track ${index === this.currentTrackIndex ? 'active' : ''}" data-index="${index}">
                <span class="track-number">${(index + 1).toString().padStart(2, '0')}</span>
                <span class="track-title">${track.title}</span>
                <span class="track-duration">${this.formatTime(track.duration)}</span>
            </div>
        `).join('');

        this.elements.playlistTracks.querySelectorAll('.playlist-track').forEach(el => {
            el.addEventListener('click', () => {
                const index = parseInt(el.dataset.index);
                this.pause();
                this.currentTrackIndex = index;
                this.loadTrack(index);
                this.currentTime = 0;
                this.play();
            });
        });
    },

    updatePlaylistUI() {
        if (!this.elements.playlistTracks) return;
        this.elements.playlistTracks.querySelectorAll('.playlist-track').forEach((el, index) => {
            el.classList.toggle('active', index === this.currentTrackIndex);
        });
    },

    updateUI() {
        if (this.playlist.length > 0) {
            this.loadTrack(this.currentTrackIndex);
        }
    },

    startWaveformAnimation() {
        if (!this.elements.waveformCanvas || !this.elements.visualizerCanvas) return;

        const waveformCtx = this.elements.waveformCanvas.getContext('2d');
        const visualizerCtx = this.elements.visualizerCanvas.getContext('2d');

        const animate = () => {
            this.drawWaveform(waveformCtx, 120, 32);
            if (this.isExpanded) {
                this.drawVisualizer(visualizerCtx, 280, 80);
            }
            this.animationFrame = requestAnimationFrame(animate);
        };
        animate();
    },

    // Get real frequency data from analyser
    getFrequencyData() {
        if (this.analyser && this.analyserData) {
            this.analyser.getByteFrequencyData(this.analyserData);
            return this.analyserData;
        }
        return null;
    },

    drawWaveform(ctx, width, height) {
        ctx.clearRect(0, 0, width, height);

        const freqData = this.getFrequencyData();
        const bars = 30;
        const barWidth = width / bars;

        // Update waveform data from real frequencies or decay
        for (let i = 0; i < bars; i++) {
            if (this.isPlaying && freqData) {
                // Map frequency bins to our bars (focus on lower frequencies for 8-bit feel)
                const freqIndex = Math.floor(i * 2.5);
                const rawValue = freqData[freqIndex] || 0;
                // Smooth the transition
                const targetValue = rawValue / 255;
                this.waveformData[i] = this.waveformData[i] * 0.6 + targetValue * 0.4;
            } else {
                this.waveformData[i] *= 0.88;
            }
        }

        // 8-bit style gradient
        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, '#22c55e');
        gradient.addColorStop(0.5, '#06b6d4');
        gradient.addColorStop(1, '#2563eb');

        // Draw pixelated bars
        this.waveformData.forEach((value, i) => {
            const barHeight = Math.max(2, value * height * 0.9);
            const x = i * barWidth;
            const y = (height - barHeight) / 2;

            // 8-bit pixel effect - draw in discrete steps
            const pixelSize = 2;
            const pixelatedHeight = Math.floor(barHeight / pixelSize) * pixelSize;
            const pixelatedY = (height - pixelatedHeight) / 2;

            ctx.fillStyle = gradient;
            ctx.fillRect(Math.floor(x) + 1, Math.floor(pixelatedY), barWidth - 2, pixelatedHeight);
        });
    },

    drawVisualizer(ctx, width, height) {
        ctx.clearRect(0, 0, width, height);

        const freqData = this.getFrequencyData();
        const bars = 32;
        const barWidth = width / bars;
        const pixelSize = 4; // 8-bit pixel size

        // 8-bit color palette
        const colors = [
            '#1e3a5f', '#2563eb', '#0891b2', '#06b6d4',
            '#22c55e', '#84cc16', '#eab308', '#f97316',
            '#ef4444', '#ec4899', '#a855f7', '#6366f1'
        ];

        for (let i = 0; i < bars; i++) {
            let normalizedValue;

            if (this.isPlaying && freqData) {
                // Map frequency bins with emphasis on lower frequencies (bass-heavy 8-bit style)
                const freqIndex = Math.floor(i * 3);
                const rawValue = freqData[freqIndex] || 0;

                // Smooth transition for this bar
                const targetValue = rawValue / 255;
                this.frequencyData[i] = (this.frequencyData[i] || 0) * 0.5 + targetValue * 0.5;
                normalizedValue = this.frequencyData[i];
            } else {
                this.frequencyData[i] = (this.frequencyData[i] || 0) * 0.85;
                normalizedValue = this.frequencyData[i];
            }

            // Calculate bar height in pixel units
            const maxPixels = Math.floor(height / pixelSize);
            const numPixels = Math.max(1, Math.floor(normalizedValue * maxPixels));

            const x = Math.floor(i * barWidth);

            // Draw each pixel block with color based on height
            for (let p = 0; p < numPixels; p++) {
                const y = height - (p + 1) * pixelSize;
                const colorIndex = Math.min(Math.floor((p / maxPixels) * colors.length), colors.length - 1);
                ctx.fillStyle = colors[colorIndex];
                ctx.fillRect(x + 1, y, barWidth - 2, pixelSize - 1);
            }

            // Add peak indicator (classic 8-bit style)
            if (numPixels > 2) {
                const peakY = height - numPixels * pixelSize - pixelSize;
                if (peakY > 0) {
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(x + 1, peakY, barWidth - 2, 2);
                }
            }
        }

        // Draw pixel grid overlay for authentic 8-bit look
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
        ctx.lineWidth = 1;
        for (let x = 0; x < width; x += barWidth) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
    }
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    MusicPlayer.init();

    // Auto-resume music on first user interaction (only if it was playing before)
    let audioInitialized = false;
    const initAudioOnInteraction = () => {
        if (!audioInitialized && MusicPlayer.initialized) {
            audioInitialized = true;
            MusicPlayer.initAudio();

            // Only auto-resume if music was playing before page transition
            if (MusicPlayer.pendingAutoResume) {
                MusicPlayer.pendingAutoResume = false;
                MusicPlayer.play();
            }
            // Don't auto-start if user hadn't started music yet

            document.removeEventListener('click', initAudioOnInteraction);
            document.removeEventListener('keydown', initAudioOnInteraction);
            document.removeEventListener('touchstart', initAudioOnInteraction);
        }
    };

    document.addEventListener('click', initAudioOnInteraction);
    document.addEventListener('keydown', initAudioOnInteraction);
    document.addEventListener('touchstart', initAudioOnInteraction);

    // Also save state periodically while playing
    setInterval(() => {
        if (MusicPlayer.isPlaying) {
            MusicPlayer.saveState();
        }
    }, 1000);
});

// Export for global access
window.MusicPlayer = MusicPlayer;
