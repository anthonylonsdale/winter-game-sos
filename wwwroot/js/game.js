// Snowball Stacker Game Engine
// Moveable platform, auto-dropping blocks, projectile hazards
// Height-based scoring with momentum transfer, sound effects, and Christmas theme

(function() {
    'use strict';

    // Matter.js module aliases
    const Engine = Matter.Engine,
          Render = Matter.Render,
          Runner = Matter.Runner,
          Bodies = Matter.Bodies,
          Body = Matter.Body,
          Composite = Matter.Composite,
          Events = Matter.Events;

    // Game configuration
    const CONFIG = {
        // Block settings - starts large and gets progressively narrower
        blockSizes: [
            { width: 160, height: 45 },  // Drop 1 - Largest
            { width: 140, height: 45 },  // Drop 2
            { width: 120, height: 40 },  // Drop 3
            { width: 100, height: 40 },  // Drop 4
            { width: 85, height: 35 },   // Drop 5
            { width: 70, height: 35 },   // Drop 6+
            { width: 60, height: 30 },   // Drop 7+
            { width: 50, height: 30 },   // Drop 8+
            { width: 40, height: 25 },   // Drop 9+
            { width: 35, height: 25 }    // Drop 10+ - Smallest
        ],
        platformWidth: 220,
        platformHeight: 18,
        platformBaseY: 80,
        gravity: 0.25,
        friction: 0.95,
        restitution: 0.02,
        timeScale: 0.35,             // Slightly faster game speed
        fallThreshold: 120,
        autoDropDelay: 350,          // Faster block drops
        projectileFrequency: 2,      // Projectiles every N blocks
        projectileTypes: ['coal', 'iceball', 'snowball', 'hailstone', 'candycane', 'ornament', 'giftbox', 'star', 'icicle', 'mistletoe'],
        platformSpeed: 0.2,          // How fast platform follows mouse
        momentumTransfer: 1.0,       // Blocks move WITH platform (glued)
        screenShakeIntensity: 8,     // Pixel intensity of screen shake
        screenShakeDuration: 150,    // Duration of screen shake in ms
        lockEveryNBlocks: 5,         // Lock stack every N blocks
        snowflakeCount: 60,          // Number of snowflakes in game
        decorationCount: 8,          // Number of background decorations
        maxLives: 3,                 // Starting lives
        projectileBaseCount: 2,      // Starting projectile count
        projectileMaxCount: 8        // Maximum projectiles at once
    };

    // ============================================
    // SOUND SYSTEM - Web Audio API (Christmas Theme)
    // ============================================
    const SoundSystem = {
        audioContext: null,
        masterGain: null,
        ambientGain: null,
        ambientNodes: [],
        bellInterval: null,
        initialized: false,

        init() {
            if (this.initialized) return;
            try {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                this.masterGain = this.audioContext.createGain();
                this.masterGain.gain.value = 0.4;
                this.masterGain.connect(this.audioContext.destination);
                this.initialized = true;
            } catch (e) {
                console.warn('Web Audio API not supported:', e);
            }
        },

        resume() {
            if (this.audioContext && this.audioContext.state === 'suspended') {
                this.audioContext.resume();
            }
        },

        // Play a single bell chime
        playBell(freq = 800, volume = 0.08) {
            if (!this.initialized) return;
            const now = this.audioContext.currentTime;

            // Bell oscillator
            const osc = this.audioContext.createOscillator();
            const osc2 = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now);
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(freq * 2.4, now); // Overtone

            gain.gain.setValueAtTime(volume, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 2);

            osc.connect(gain);
            osc2.connect(gain);
            gain.connect(this.masterGain);

            osc.start(now);
            osc2.start(now);
            osc.stop(now + 2);
            osc2.stop(now + 2);
        },

        // Create Christmas ambient sound (gentle bells and chimes)
        startAmbientWind() {
            if (!this.initialized) return;
            this.resume();

            // Soft pad/drone for atmosphere
            this.ambientGain = this.audioContext.createGain();
            this.ambientGain.gain.value = 0.03;
            this.ambientGain.connect(this.masterGain);

            // Create soft shimmer
            const bufferSize = 2 * this.audioContext.sampleRate;
            const noiseBuffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
            const output = noiseBuffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                output[i] = Math.random() * 2 - 1;
            }

            const shimmer = this.audioContext.createBufferSource();
            shimmer.buffer = noiseBuffer;
            shimmer.loop = true;

            const filter = this.audioContext.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.value = 3000;
            filter.Q.value = 5;

            shimmer.connect(filter);
            filter.connect(this.ambientGain);
            shimmer.start();
            this.ambientNodes.push(shimmer);

            // Random gentle bells
            const bellFreqs = [523, 659, 784, 880, 1047, 1319]; // C5, E5, G5, A5, C6, E6
            this.bellInterval = setInterval(() => {
                if (Math.random() < 0.3) {
                    const freq = bellFreqs[Math.floor(Math.random() * bellFreqs.length)];
                    this.playBell(freq, 0.04 + Math.random() * 0.03);
                }
            }, 1500);

            // Play initial welcoming bells
            setTimeout(() => this.playBell(523, 0.06), 100);
            setTimeout(() => this.playBell(659, 0.05), 300);
            setTimeout(() => this.playBell(784, 0.04), 500);
        },

        stopAmbientWind() {
            this.ambientNodes.forEach(node => {
                try { node.stop(); } catch(e) {}
            });
            this.ambientNodes = [];
            if (this.bellInterval) {
                clearInterval(this.bellInterval);
                this.bellInterval = null;
            }
        },

        // Sleigh bells sound
        playSleighBells() {
            if (!this.initialized) return;
            this.resume();
            const now = this.audioContext.currentTime;

            for (let i = 0; i < 5; i++) {
                const osc = this.audioContext.createOscillator();
                const gain = this.audioContext.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(2000 + Math.random() * 1000, now + i * 0.05);
                gain.gain.setValueAtTime(0.05, now + i * 0.05);
                gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.05 + 0.1);
                osc.connect(gain);
                gain.connect(this.masterGain);
                osc.start(now + i * 0.05);
                osc.stop(now + i * 0.05 + 0.15);
            }
        },

        // Soft landing sound (snow/ice landing)
        playLanding(intensity = 0.5) {
            if (!this.initialized) return;
            this.resume();

            const now = this.audioContext.currentTime;

            // White noise burst for "poof" sound
            const bufferSize = this.audioContext.sampleRate * 0.15;
            const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
            }

            const noise = this.audioContext.createBufferSource();
            noise.buffer = buffer;

            const filter = this.audioContext.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 800 + intensity * 400;

            const gain = this.audioContext.createGain();
            gain.gain.setValueAtTime(0.15 * intensity, now);
            gain.gain.exponentialDecayTo = 0.001;
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

            noise.connect(filter);
            filter.connect(gain);
            gain.connect(this.masterGain);
            noise.start(now);
            noise.stop(now + 0.15);

            // Add a soft thump
            const osc = this.audioContext.createOscillator();
            const oscGain = this.audioContext.createGain();
            osc.frequency.setValueAtTime(150 + intensity * 50, now);
            osc.frequency.exponentialRampToValueAtTime(60, now + 0.08);
            oscGain.gain.setValueAtTime(0.12 * intensity, now);
            oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
            osc.connect(oscGain);
            oscGain.connect(this.masterGain);
            osc.start(now);
            osc.stop(now + 0.1);
        },

        // Impact sound (projectile hit)
        playImpact(type = 'coal') {
            if (!this.initialized) return;
            this.resume();

            const now = this.audioContext.currentTime;
            const configs = {
                coal: { freq: 100, duration: 0.2, noise: 0.3 },
                iceball: { freq: 800, duration: 0.15, noise: 0.5 },
                snowball: { freq: 200, duration: 0.1, noise: 0.8 },
                hailstone: { freq: 600, duration: 0.12, noise: 0.4 },
                candycane: { freq: 1200, duration: 0.1, noise: 0.2 },
                ornament: { freq: 1500, duration: 0.25, noise: 0.6 }
            };
            const config = configs[type] || configs.coal;

            // Noise burst
            const noiseBuffer = this.audioContext.createBuffer(1,
                this.audioContext.sampleRate * config.duration,
                this.audioContext.sampleRate);
            const noiseData = noiseBuffer.getChannelData(0);
            for (let i = 0; i < noiseData.length; i++) {
                noiseData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / noiseData.length, 2);
            }

            const noise = this.audioContext.createBufferSource();
            noise.buffer = noiseBuffer;

            const noiseFilter = this.audioContext.createBiquadFilter();
            noiseFilter.type = 'bandpass';
            noiseFilter.frequency.value = config.freq * 2;
            noiseFilter.Q.value = 1;

            const noiseGain = this.audioContext.createGain();
            noiseGain.gain.value = 0.2 * config.noise;

            noise.connect(noiseFilter);
            noiseFilter.connect(noiseGain);
            noiseGain.connect(this.masterGain);
            noise.start(now);
            noise.stop(now + config.duration);

            // Tone component
            const osc = this.audioContext.createOscillator();
            const oscGain = this.audioContext.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(config.freq, now);
            osc.frequency.exponentialRampToValueAtTime(config.freq * 0.5, now + config.duration);
            oscGain.gain.setValueAtTime(0.15, now);
            oscGain.gain.exponentialRampToValueAtTime(0.001, now + config.duration);
            osc.connect(oscGain);
            oscGain.connect(this.masterGain);
            osc.start(now);
            osc.stop(now + config.duration);
        },

        // Game over sound
        playGameOver() {
            if (!this.initialized) return;
            this.resume();

            const now = this.audioContext.currentTime;

            // Descending tone
            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(400, now);
            osc.frequency.exponentialRampToValueAtTime(100, now + 0.8);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 1);
            osc.connect(gain);
            gain.connect(this.masterGain);
            osc.start(now);
            osc.stop(now + 1);

            // Second descending tone (harmony)
            const osc2 = this.audioContext.createOscillator();
            const gain2 = this.audioContext.createGain();
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(300, now + 0.1);
            osc2.frequency.exponentialRampToValueAtTime(75, now + 0.9);
            gain2.gain.setValueAtTime(0.15, now + 0.1);
            gain2.gain.exponentialRampToValueAtTime(0.001, now + 1);
            osc2.connect(gain2);
            gain2.connect(this.masterGain);
            osc2.start(now + 0.1);
            osc2.stop(now + 1);
        },

        // Stacking success sound
        playStack(height) {
            if (!this.initialized) return;
            this.resume();

            const now = this.audioContext.currentTime;
            const baseFreq = 300 + Math.min(height, 300);

            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(baseFreq, now);
            osc.frequency.setValueAtTime(baseFreq * 1.25, now + 0.05);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
            osc.connect(gain);
            gain.connect(this.masterGain);
            osc.start(now);
            osc.stop(now + 0.15);
        },

        // Stack lock sound (magical chime)
        playLock() {
            if (!this.initialized) return;
            this.resume();

            const now = this.audioContext.currentTime;
            const notes = [523, 659, 784, 1047]; // C E G C arpeggio

            notes.forEach((freq, i) => {
                const osc = this.audioContext.createOscillator();
                const gain = this.audioContext.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, now + i * 0.08);
                gain.gain.setValueAtTime(0.12, now + i * 0.08);
                gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.4);
                osc.connect(gain);
                gain.connect(this.masterGain);
                osc.start(now + i * 0.08);
                osc.stop(now + i * 0.08 + 0.5);
            });

            // Add shimmer
            this.playSleighBells();
        },

        // Lose life sound (hurt sound)
        playLoseLife() {
            if (!this.initialized) return;
            this.resume();

            const now = this.audioContext.currentTime;

            // Descending "oof" sound
            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(300, now);
            osc.frequency.exponentialRampToValueAtTime(100, now + 0.2);
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
            osc.connect(gain);
            gain.connect(this.masterGain);
            osc.start(now);
            osc.stop(now + 0.3);

            // Add noise burst
            const bufferSize = this.audioContext.sampleRate * 0.15;
            const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
            }
            const noise = this.audioContext.createBufferSource();
            noise.buffer = buffer;
            const noiseGain = this.audioContext.createGain();
            noiseGain.gain.value = 0.1;
            noise.connect(noiseGain);
            noiseGain.connect(this.masterGain);
            noise.start(now);
            noise.stop(now + 0.15);
        },

        // Projectile spawn warning - dramatic incoming sound
        playProjectileSpawn() {
            if (!this.initialized) return;
            this.resume();

            const now = this.audioContext.currentTime;

            // Warning siren/alarm sound
            const osc = this.audioContext.createOscillator();
            const oscGain = this.audioContext.createGain();
            osc.type = 'square';
            osc.frequency.setValueAtTime(600, now);
            osc.frequency.setValueAtTime(800, now + 0.1);
            osc.frequency.setValueAtTime(600, now + 0.2);
            osc.frequency.setValueAtTime(800, now + 0.3);
            oscGain.gain.setValueAtTime(0.08, now);
            oscGain.gain.setValueAtTime(0.06, now + 0.15);
            oscGain.gain.setValueAtTime(0.08, now + 0.3);
            oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
            osc.connect(oscGain);
            oscGain.connect(this.masterGain);
            osc.start(now);
            osc.stop(now + 0.5);

            // Whoosh sound
            const bufferSize = this.audioContext.sampleRate * 0.4;
            const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                const t = i / bufferSize;
                data[i] = (Math.random() * 2 - 1) * Math.sin(t * Math.PI) * 0.6;
            }

            const noise = this.audioContext.createBufferSource();
            noise.buffer = buffer;

            const filter = this.audioContext.createBiquadFilter();
            filter.type = 'highpass';
            filter.frequency.setValueAtTime(3000, now);
            filter.frequency.exponentialRampToValueAtTime(300, now + 0.4);

            const gain = this.audioContext.createGain();
            gain.gain.setValueAtTime(0.12, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

            noise.connect(filter);
            filter.connect(gain);
            gain.connect(this.masterGain);
            noise.start(now);
            noise.stop(now + 0.4);
        },

        // Individual projectile launch sound
        playProjectileLaunch(type = 'coal') {
            if (!this.initialized) return;
            this.resume();

            const now = this.audioContext.currentTime;

            // Different sounds for different projectile types
            const sounds = {
                coal: { freq: 150, type: 'sawtooth', duration: 0.15 },
                iceball: { freq: 1200, type: 'sine', duration: 0.2 },
                snowball: { freq: 400, type: 'triangle', duration: 0.12 },
                hailstone: { freq: 800, type: 'square', duration: 0.1 },
                candycane: { freq: 1000, type: 'sine', duration: 0.15 },
                ornament: { freq: 600, type: 'sine', duration: 0.25 },
                giftbox: { freq: 300, type: 'square', duration: 0.15 },
                star: { freq: 1500, type: 'sine', duration: 0.3 },
                icicle: { freq: 900, type: 'triangle', duration: 0.18 },
                mistletoe: { freq: 500, type: 'sine', duration: 0.15 }
            };

            const config = sounds[type] || sounds.coal;

            // Main tone - descending (falling from above)
            const osc = this.audioContext.createOscillator();
            const oscGain = this.audioContext.createGain();
            osc.type = config.type;
            osc.frequency.setValueAtTime(config.freq * 1.5, now);
            osc.frequency.exponentialRampToValueAtTime(config.freq, now + config.duration);
            oscGain.gain.setValueAtTime(0.1, now);
            oscGain.gain.exponentialRampToValueAtTime(0.001, now + config.duration);
            osc.connect(oscGain);
            oscGain.connect(this.masterGain);
            osc.start(now);
            osc.stop(now + config.duration);

            // Add sparkle for special types
            if (['star', 'ornament', 'iceball'].includes(type)) {
                const sparkle = this.audioContext.createOscillator();
                const sparkleGain = this.audioContext.createGain();
                sparkle.type = 'sine';
                sparkle.frequency.setValueAtTime(2000 + Math.random() * 1000, now);
                sparkleGain.gain.setValueAtTime(0.05, now);
                sparkleGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
                sparkle.connect(sparkleGain);
                sparkleGain.connect(this.masterGain);
                sparkle.start(now);
                sparkle.stop(now + 0.1);
            }
        },

        // ============================================
        // CHRISTMAS MUSIC SYSTEM - Title & Gameplay
        // ============================================
        musicPlaying: false,
        musicTimeout: null,
        musicGain: null,
        currentTrack: 'title', // 'title' or 'gameplay'

        // Note frequencies (Hz) - Extended for Christmas songs
        NOTE: {
            // Octave 3
            C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.00, A3: 220.00, B3: 246.94,
            Bb3: 233.08, Fs3: 185.00,
            // Octave 4
            C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.00, A4: 440.00, B4: 493.88,
            Bb4: 466.16, Fs4: 369.99, Gs4: 415.30,
            // Octave 5
            C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.00, B5: 987.77,
            Bb5: 932.33
        },

        // Start title screen music
        startTitleMusic() {
            if (!this.initialized) return;
            this.stopMusic();
            this.resume();
            this.musicPlaying = true;
            this.currentTrack = 'title';
            this.currentSection = 0;

            this.musicGain = this.audioContext.createGain();
            this.musicGain.gain.value = 0.10;
            this.musicGain.connect(this.masterGain);

            this.playTitleMusicLoop();
        },

        // Start gameplay music (Jingle Bells)
        startMusic() {
            if (!this.initialized) return;
            this.stopMusic();
            this.resume();
            this.musicPlaying = true;
            this.currentTrack = 'gameplay';
            this.currentSection = 0;

            this.musicGain = this.audioContext.createGain();
            this.musicGain.gain.value = 0.12;
            this.musicGain.connect(this.masterGain);

            this.playChristmasMusicLoop();
        },

        stopMusic() {
            this.musicPlaying = false;
            if (this.musicTimeout) {
                clearTimeout(this.musicTimeout);
                this.musicTimeout = null;
            }
        },

        // Title Screen Music - "We Wish You a Merry Christmas" style melody
        playTitleMusicLoop() {
            if (!this.initialized || !this.musicPlaying || this.currentTrack !== 'title') return;

            const BPM = 120;
            const eighth = 60 / BPM / 2;
            const quarter = 60 / BPM;
            const half = quarter * 2;
            const dottedQuarter = quarter * 1.5;
            const now = this.audioContext.currentTime;
            const N = this.NOTE;

            const section = this.currentSection % 2;
            this.currentSection++;

            let melody, harmony, bass, sectionBars;

            if (section === 0) {
                // Main melody - cheerful Christmas tune
                melody = [
                    [N.G4, quarter], [N.C5, quarter], [N.C5, eighth], [N.D5, eighth],
                    [N.C5, eighth], [N.B4, eighth], [N.A4, quarter], [N.A4, quarter],
                    [N.A4, quarter], [N.D5, quarter], [N.D5, eighth], [N.E5, eighth],
                    [N.D5, eighth], [N.C5, eighth], [N.B4, quarter], [N.G4, quarter],
                    [N.G4, quarter], [N.E5, quarter], [N.E5, eighth], [N.F5, eighth],
                    [N.E5, eighth], [N.D5, eighth], [N.C5, quarter], [N.A4, quarter],
                    [N.G4, eighth], [N.G4, eighth], [N.A4, quarter], [N.D5, quarter],
                    [N.B4, quarter], [N.C5, half]
                ];
                harmony = [
                    [N.E4, quarter], [N.G4, quarter], [N.G4, eighth], [N.A4, eighth],
                    [N.G4, eighth], [N.F4, eighth], [N.E4, quarter], [N.E4, quarter],
                    [N.F4, quarter], [N.A4, quarter], [N.A4, eighth], [N.B4, eighth],
                    [N.A4, eighth], [N.G4, eighth], [N.F4, quarter], [N.D4, quarter],
                    [N.E4, quarter], [N.C5, quarter], [N.C5, eighth], [N.D5, eighth],
                    [N.C5, eighth], [N.B4, eighth], [N.A4, quarter], [N.F4, quarter],
                    [N.E4, eighth], [N.E4, eighth], [N.F4, quarter], [N.A4, quarter],
                    [N.G4, quarter], [N.E4, half]
                ];
                bass = [
                    N.C3, N.C3, N.C3, N.C3, N.F3, N.F3, N.F3, N.F3,
                    N.D3, N.D3, N.D3, N.D3, N.G3, N.G3, N.G3, N.G3,
                    N.C3, N.C3, N.C3, N.C3, N.F3, N.F3, N.F3, N.F3,
                    N.G3, N.G3, N.G3, N.G3, N.C3, N.C3, N.C3, N.C3
                ];
                sectionBars = 8;
            } else {
                // Variation - gentle arpeggio section
                melody = [
                    [N.C4, eighth], [N.E4, eighth], [N.G4, eighth], [N.C5, eighth],
                    [N.G4, quarter], [N.E4, quarter],
                    [N.D4, eighth], [N.F4, eighth], [N.A4, eighth], [N.D5, eighth],
                    [N.A4, quarter], [N.F4, quarter],
                    [N.E4, eighth], [N.G4, eighth], [N.B4, eighth], [N.E5, eighth],
                    [N.D5, quarter], [N.C5, quarter],
                    [N.G4, quarter], [N.F4, quarter], [N.E4, quarter], [N.D4, quarter],
                    [N.C4, half], [0, half]
                ];
                harmony = [
                    [N.G3, eighth], [N.C4, eighth], [N.E4, eighth], [N.G4, eighth],
                    [N.E4, quarter], [N.C4, quarter],
                    [N.A3, eighth], [N.D4, eighth], [N.F4, eighth], [N.A4, eighth],
                    [N.F4, quarter], [N.D4, quarter],
                    [N.B3, eighth], [N.E4, eighth], [N.G4, eighth], [N.B4, eighth],
                    [N.A4, quarter], [N.G4, quarter],
                    [N.E4, quarter], [N.D4, quarter], [N.C4, quarter], [N.B3, quarter],
                    [N.G3, half], [0, half]
                ];
                bass = [
                    N.C3, N.C3, N.G3, N.G3, N.C3, N.C3, N.G3, N.G3,
                    N.D3, N.D3, N.A3, N.A3, N.D3, N.D3, N.A3, N.A3,
                    N.E3, N.E3, N.B3, N.B3, N.E3, N.G3, N.A3, N.B3,
                    N.C3, N.E3, N.G3, N.C3, N.C3, N.C3, N.C3, N.C3
                ];
                sectionBars = 8;
            }

            // Play melody with soft bells
            let melodyTime = now + 0.05;
            melody.forEach(([note, dur]) => {
                if (note > 0) {
                    this.playTitleNote(note, dur * 0.9, melodyTime, 1);
                }
                melodyTime += dur;
            });

            // Play harmony
            let harmonyTime = now + 0.05;
            harmony.forEach(([note, dur]) => {
                if (note > 0) {
                    this.playTitleNote(note, dur * 0.85, harmonyTime, 2);
                }
                harmonyTime += dur;
            });

            // Play soft bass
            let bassTime = now + 0.05;
            bass.forEach((note) => {
                if (note > 0) {
                    this.playBassNote(note, quarter * 0.8, bassTime);
                }
                bassTime += quarter;
            });

            // Gentle bells only on downbeats
            let bellTime = now + 0.05;
            for (let i = 0; i < sectionBars * 2; i++) {
                if (i % 2 === 0) {
                    this.playSoftBell(bellTime);
                }
                bellTime += half;
            }

            // Loop
            const loopDuration = (quarter * sectionBars * 4) * 1000;
            this.musicTimeout = setTimeout(() => {
                if (this.musicPlaying && this.currentTrack === 'title') {
                    this.playTitleMusicLoop();
                }
            }, loopDuration - 50);
        },

        // Soft title screen note
        playTitleNote(freq, duration, startTime, channel = 1) {
            if (!this.initialized || !this.musicPlaying) return;

            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();

            osc.type = 'sine'; // Softer sine waves for title
            osc.frequency.value = freq;

            if (channel === 2) {
                osc.detune.value = 5;
                gain.gain.setValueAtTime(0, startTime);
                gain.gain.linearRampToValueAtTime(0.08, startTime + 0.02);
            } else {
                gain.gain.setValueAtTime(0, startTime);
                gain.gain.linearRampToValueAtTime(0.12, startTime + 0.01);
            }

            gain.gain.setValueAtTime(gain.gain.value, startTime + duration * 0.7);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

            osc.connect(gain);
            gain.connect(this.musicGain);

            osc.start(startTime);
            osc.stop(startTime + duration);
        },

        // Soft bell for title screen
        playSoftBell(startTime) {
            if (!this.initialized || !this.musicPlaying) return;

            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();

            osc.type = 'sine';
            osc.frequency.value = 1200 + Math.random() * 400;

            gain.gain.setValueAtTime(0.03, startTime);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.3);

            osc.connect(gain);
            gain.connect(this.musicGain);

            osc.start(startTime);
            osc.stop(startTime + 0.3);
        },

        // Play a square wave note (8-bit style) with vibrato for bells
        playSquareNote(freq, duration, startTime, channel = 1, vibrato = false) {
            if (!this.initialized || !this.musicPlaying) return;

            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();

            osc.type = channel === 1 ? 'square' : 'pulse' in osc ? 'pulse' : 'square';
            osc.frequency.value = freq;

            if (channel === 2) {
                osc.detune.value = 7; // Slight detune for richness
            }

            // Add subtle vibrato for bell-like quality
            if (vibrato) {
                const lfo = this.audioContext.createOscillator();
                const lfoGain = this.audioContext.createGain();
                lfo.frequency.value = 5;
                lfoGain.gain.value = 3;
                lfo.connect(lfoGain);
                lfoGain.connect(osc.detune);
                lfo.start(startTime);
                lfo.stop(startTime + duration);
            }

            // Bell-like envelope
            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(0.15, startTime + 0.01);
            gain.gain.setValueAtTime(0.12, startTime + duration * 0.1);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

            osc.connect(gain);
            gain.connect(this.musicGain);

            osc.start(startTime);
            osc.stop(startTime + duration);
        },

        // Play sleigh bell sound
        playSleighBell(startTime) {
            if (!this.initialized || !this.musicPlaying) return;

            const bufferSize = this.audioContext.sampleRate * 0.08;
            const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
            const data = buffer.getChannelData(0);

            for (let i = 0; i < bufferSize; i++) {
                const env = Math.exp(-i / (bufferSize * 0.3));
                data[i] = (Math.random() * 2 - 1) * env;
            }

            const noise = this.audioContext.createBufferSource();
            noise.buffer = buffer;

            const filter = this.audioContext.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.value = 8000;
            filter.Q.value = 2;

            const gain = this.audioContext.createGain();
            gain.gain.value = 0.06;

            noise.connect(filter);
            filter.connect(gain);
            gain.connect(this.musicGain);

            noise.start(startTime);
            noise.stop(startTime + 0.08);
        },

        // Play triangle wave bass note
        playBassNote(freq, duration, startTime) {
            if (!this.initialized || !this.musicPlaying) return;

            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();

            osc.type = 'triangle';
            osc.frequency.value = freq;

            gain.gain.setValueAtTime(0.18, startTime);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

            osc.connect(gain);
            gain.connect(this.musicGain);

            osc.start(startTime);
            osc.stop(startTime + duration);
        },

        // Play kick/snare drum
        playDrum(startTime, isKick) {
            if (!this.initialized || !this.musicPlaying) return;

            const bufferSize = this.audioContext.sampleRate * 0.08;
            const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
            const data = buffer.getChannelData(0);

            for (let i = 0; i < bufferSize; i++) {
                const env = Math.exp(-i / (bufferSize * (isKick ? 0.15 : 0.08)));
                data[i] = (Math.random() * 2 - 1) * env;
            }

            const noise = this.audioContext.createBufferSource();
            noise.buffer = buffer;

            const filter = this.audioContext.createBiquadFilter();
            filter.type = isKick ? 'lowpass' : 'highpass';
            filter.frequency.value = isKick ? 200 : 6000;

            const gain = this.audioContext.createGain();
            gain.gain.value = isKick ? 0.15 : 0.05;

            noise.connect(filter);
            filter.connect(gain);
            gain.connect(this.musicGain);

            noise.start(startTime);
            noise.stop(startTime + 0.08);
        },

        currentSection: 0,

        // Main Christmas Music Loop - Jingle Bells with variations
        playChristmasMusicLoop() {
            if (!this.initialized || !this.musicPlaying) return;

            const BPM = 140;
            const sixteenth = 60 / BPM / 4;
            const eighth = 60 / BPM / 2;
            const quarter = 60 / BPM;
            const half = quarter * 2;
            const whole = quarter * 4;
            const now = this.audioContext.currentTime;
            const N = this.NOTE;

            const section = this.currentSection % 4;
            this.currentSection++;

            let melody, harmony, bass, sectionBars;

            if (section === 0 || section === 2) {
                // ===== JINGLE BELLS - Main Chorus =====
                // "Jingle bells, jingle bells, jingle all the way"
                melody = [
                    // Bar 1: "Jin-gle bells"
                    [N.E4, quarter], [N.E4, quarter], [N.E4, half],
                    // Bar 2: "Jin-gle bells"
                    [N.E4, quarter], [N.E4, quarter], [N.E4, half],
                    // Bar 3: "Jin-gle all the way"
                    [N.E4, quarter], [N.G4, quarter], [N.C4, quarter], [N.D4, quarter],
                    // Bar 4: "way" (held) + rest
                    [N.E4, half + quarter], [0, quarter],
                    // Bar 5: "Oh what fun"
                    [N.F4, quarter], [N.F4, quarter], [N.F4, quarter], [N.F4, eighth], [N.F4, eighth],
                    // Bar 6: "it is to ride"
                    [N.F4, quarter], [N.E4, quarter], [N.E4, quarter], [N.E4, eighth], [N.E4, eighth],
                    // Bar 7: "in a one horse"
                    [N.E4, quarter], [N.D4, quarter], [N.D4, quarter], [N.E4, quarter],
                    // Bar 8: "open sleigh" -> G
                    [N.D4, half], [N.G4, half]
                ];
                harmony = [
                    [N.C4, quarter], [N.C4, quarter], [N.C4, half],
                    [N.C4, quarter], [N.C4, quarter], [N.C4, half],
                    [N.C4, quarter], [N.E4, quarter], [N.G3, quarter], [N.B3, quarter],
                    [N.C4, half + quarter], [0, quarter],
                    [N.D4, quarter], [N.D4, quarter], [N.D4, quarter], [N.D4, eighth], [N.D4, eighth],
                    [N.D4, quarter], [N.C4, quarter], [N.C4, quarter], [N.C4, eighth], [N.C4, eighth],
                    [N.C4, quarter], [N.B3, quarter], [N.B3, quarter], [N.C4, quarter],
                    [N.B3, half], [N.D4, half]
                ];
                bass = [
                    N.C3, N.C3, N.C3, N.C3, N.C3, N.C3, N.C3, N.C3,
                    N.C3, N.E3, N.F3, N.G3, N.C3, N.C3, N.G3, N.G3,
                    N.F3, N.F3, N.F3, N.F3, N.F3, N.C3, N.C3, N.C3,
                    N.G3, N.G3, N.G3, N.C3, N.G3, N.G3, N.G3, N.G3
                ];
                sectionBars = 8;

            } else if (section === 1) {
                // ===== JINGLE BELLS - Verse (Dashing through the snow) =====
                melody = [
                    // "Dashing through the snow"
                    [N.E4, eighth], [N.E4, eighth], [N.E4, eighth], [N.E4, eighth],
                    [N.E4, quarter], [N.D4, quarter],
                    // "In a one horse open sleigh"
                    [N.D4, eighth], [N.D4, eighth], [N.D4, eighth], [N.D4, eighth],
                    [N.E4, quarter], [N.D4, quarter],
                    // "O'er the fields we go"
                    [N.E4, eighth], [N.E4, eighth], [N.E4, eighth], [N.E4, eighth],
                    [N.E4, quarter], [N.D4, quarter],
                    // "Laughing all the way"
                    [N.E4, quarter], [N.D4, quarter], [N.C4, half]
                ];
                harmony = [
                    [N.C4, eighth], [N.C4, eighth], [N.C4, eighth], [N.C4, eighth],
                    [N.C4, quarter], [N.B3, quarter],
                    [N.B3, eighth], [N.B3, eighth], [N.B3, eighth], [N.B3, eighth],
                    [N.C4, quarter], [N.B3, quarter],
                    [N.C4, eighth], [N.C4, eighth], [N.C4, eighth], [N.C4, eighth],
                    [N.C4, quarter], [N.B3, quarter],
                    [N.C4, quarter], [N.B3, quarter], [N.G3, half]
                ];
                bass = [
                    N.C3, N.C3, N.G3, N.G3, N.C3, N.C3, N.G3, N.G3,
                    N.G3, N.G3, N.D3, N.D3, N.G3, N.G3, N.G3, N.G3,
                    N.C3, N.C3, N.G3, N.G3, N.F3, N.F3, N.G3, N.G3,
                    N.C3, N.G3, N.C3, N.C3
                ];
                sectionBars = 4;

            } else {
                // ===== VARIATION - Arpeggiated/Festive Bridge =====
                melody = [
                    // Arpeggio runs
                    [N.C4, sixteenth], [N.E4, sixteenth], [N.G4, sixteenth], [N.C5, sixteenth],
                    [N.E5, quarter], [N.D5, quarter],
                    [N.D4, sixteenth], [N.F4, sixteenth], [N.A4, sixteenth], [N.D5, sixteenth],
                    [N.F5, quarter], [N.E5, quarter],
                    // Descending
                    [N.E5, eighth], [N.D5, eighth], [N.C5, eighth], [N.B4, eighth],
                    [N.A4, eighth], [N.G4, eighth], [N.F4, eighth], [N.E4, eighth],
                    // Big finish
                    [N.C5, quarter], [N.G4, quarter], [N.E4, quarter], [N.C4, quarter]
                ];
                harmony = [
                    [N.G3, sixteenth], [N.C4, sixteenth], [N.E4, sixteenth], [N.G4, sixteenth],
                    [N.C5, quarter], [N.B4, quarter],
                    [N.A3, sixteenth], [N.D4, sixteenth], [N.F4, sixteenth], [N.A4, sixteenth],
                    [N.D5, quarter], [N.C5, quarter],
                    [N.C5, eighth], [N.B4, eighth], [N.A4, eighth], [N.G4, eighth],
                    [N.F4, eighth], [N.E4, eighth], [N.D4, eighth], [N.C4, eighth],
                    [N.E4, quarter], [N.E4, quarter], [N.C4, quarter], [N.G3, quarter]
                ];
                bass = [
                    N.C3, N.C3, N.G3, N.G3, N.C3, N.C3, N.G3, N.G3,
                    N.D3, N.D3, N.A3, N.A3, N.D3, N.D3, N.A3, N.A3,
                    N.E3, N.E3, N.A3, N.A3, N.F3, N.G3, N.A3, N.B3,
                    N.C3, N.E3, N.G3, N.C3
                ];
                sectionBars = 4;
            }

            // Play melody with bell-like vibrato
            let melodyTime = now + 0.05;
            melody.forEach(([note, dur]) => {
                if (note > 0) {
                    this.playSquareNote(note, dur * 0.92, melodyTime, 1, true);
                }
                melodyTime += dur;
            });

            // Play harmony
            let harmonyTime = now + 0.05;
            harmony.forEach(([note, dur]) => {
                if (note > 0) {
                    this.playSquareNote(note, dur * 0.88, harmonyTime, 2, false);
                }
                harmonyTime += dur;
            });

            // Play bass
            let bassTime = now + 0.05;
            const bassNoteDur = quarter;
            bass.forEach((note) => {
                if (note > 0) {
                    this.playBassNote(note, bassNoteDur * 0.9, bassTime);
                }
                bassTime += bassNoteDur;
            });

            // Play drums - festive pattern with sleigh bells
            let drumTime = now + 0.05;
            const totalEighths = sectionBars * 8;
            for (let i = 0; i < totalEighths; i++) {
                // Kick on beats 1 and 3
                if (i % 4 === 0) this.playDrum(drumTime, true);
                // Snare on beats 2 and 4
                if (i % 4 === 2) this.playDrum(drumTime, false);
                // Sleigh bells on every eighth note (Christmas feel!)
                this.playSleighBell(drumTime);

                drumTime += eighth;
            }

            // Loop the music
            const loopDuration = (quarter * sectionBars * 4) * 1000;
            this.musicTimeout = setTimeout(() => {
                if (this.musicPlaying) {
                    this.playChristmasMusicLoop();
                }
            }, loopDuration - 50);
        }
    };

    // Projectile configurations - Enhanced with more variety and effects
    const PROJECTILES = {
        coal: {
            size: 18,
            density: 0.006,
            restitution: 0.4,
            color: '#1f2937',
            borderColor: '#4b5563',
            glowColor: 'rgba(239, 68, 68, 0.6)',
            impactForce: 0.015,
            shape: 'circle',
            trail: true,
            trailColor: 'rgba(239, 68, 68, 0.4)',
            particleColor: '#ef4444',
            description: 'Burning coal'
        },
        iceball: {
            size: 16,
            density: 0.004,
            restitution: 0.7,
            color: '#67e8f9',
            borderColor: '#06b6d4',
            glowColor: 'rgba(6, 182, 212, 0.5)',
            impactForce: 0.012,
            shape: 'circle',
            trail: true,
            trailColor: 'rgba(103, 232, 249, 0.5)',
            particleColor: '#a5f3fc',
            sparkle: true,
            description: 'Frozen iceball'
        },
        snowball: {
            size: 22,
            density: 0.002,
            restitution: 0.3,
            color: '#f8fafc',
            borderColor: '#cbd5e1',
            glowColor: 'rgba(255, 255, 255, 0.4)',
            impactForce: 0.008,
            shape: 'circle',
            trail: true,
            trailColor: 'rgba(255, 255, 255, 0.6)',
            particleColor: '#ffffff',
            description: 'Fluffy snowball'
        },
        hailstone: {
            size: 12,
            density: 0.009,
            restitution: 0.65,
            color: '#e0f2fe',
            borderColor: '#7dd3fc',
            glowColor: 'rgba(125, 211, 252, 0.5)',
            impactForce: 0.02,
            shape: 'polygon',
            sides: 6,
            trail: true,
            trailColor: 'rgba(186, 230, 253, 0.4)',
            particleColor: '#bae6fd',
            sparkle: true,
            description: 'Sharp hailstone'
        },
        candycane: {
            size: 14,
            density: 0.005,
            restitution: 0.35,
            color: '#dc2626',
            borderColor: '#ffffff',
            glowColor: 'rgba(220, 38, 38, 0.4)',
            impactForce: 0.014,
            shape: 'rectangle',
            stripes: true,
            trail: false,
            particleColor: '#fecaca',
            description: 'Candy cane'
        },
        ornament: {
            size: 20,
            density: 0.003,
            restitution: 0.75,
            color: '#dc2626',
            borderColor: '#fbbf24',
            glowColor: 'rgba(251, 191, 36, 0.6)',
            impactForce: 0.01,
            shape: 'circle',
            shiny: true,
            trail: true,
            trailColor: 'rgba(251, 191, 36, 0.5)',
            particleColor: '#fde047',
            sparkle: true,
            description: 'Christmas ornament'
        },
        giftbox: {
            size: 18,
            density: 0.007,
            restitution: 0.3,
            color: '#22c55e',
            borderColor: '#dc2626',
            glowColor: 'rgba(34, 197, 94, 0.4)',
            impactForce: 0.016,
            shape: 'rectangle',
            ribbon: true,
            trail: false,
            particleColor: '#86efac',
            description: 'Gift box'
        },
        star: {
            size: 16,
            density: 0.004,
            restitution: 0.5,
            color: '#fbbf24',
            borderColor: '#fef08a',
            glowColor: 'rgba(251, 191, 36, 0.7)',
            impactForce: 0.013,
            shape: 'polygon',
            sides: 5,
            trail: true,
            trailColor: 'rgba(254, 240, 138, 0.6)',
            particleColor: '#fef08a',
            sparkle: true,
            spin: true,
            description: 'Christmas star'
        },
        icicle: {
            size: 20,
            density: 0.006,
            restitution: 0.4,
            color: '#e0f2fe',
            borderColor: '#38bdf8',
            glowColor: 'rgba(56, 189, 248, 0.5)',
            impactForce: 0.018,
            shape: 'triangle',
            trail: true,
            trailColor: 'rgba(186, 230, 253, 0.5)',
            particleColor: '#bae6fd',
            sparkle: true,
            description: 'Sharp icicle'
        },
        mistletoe: {
            size: 15,
            density: 0.003,
            restitution: 0.6,
            color: '#16a34a',
            borderColor: '#dc2626',
            glowColor: 'rgba(22, 163, 74, 0.4)',
            impactForce: 0.009,
            shape: 'circle',
            berries: true,
            trail: false,
            particleColor: '#bbf7d0',
            description: 'Mistletoe'
        }
    };

    // Projectile visual effects state
    const projectileEffects = {
        trails: [], // Store trail particles
        sparkles: [] // Store sparkle effects
    };

    // Game state
    let state = {
        engine: null,
        render: null,
        runner: null,
        platform: null,
        currentBlock: null,
        stackedBlocks: [],
        projectiles: [],
        blocksDropped: 0,
        blocksStacked: 0,
        currentHeight: 0,
        maxHeight: 0,
        isGameOver: false,
        gameStarted: false,
        mouseX: 0,
        canvasWidth: 0,
        canvasHeight: 0,
        waitingForSettle: false,
        platformTargetX: 0,
        platformLastX: 0,           // For momentum tracking
        platformVelocity: 0,        // Current platform velocity
        screenShake: { x: 0, y: 0, duration: 0, startTime: 0 },
        snowflakes: [],             // Visual snowflakes
        decorations: [],            // Background decorations
        lockedBlocks: new Set(),    // Blocks that are locked (resistant to knockback)
        lastLockCount: 0,           // Track when we last locked
        lives: 3,                   // Current lives
        isInvulnerable: false,      // Brief invulnerability after hit
        isDragging: false,          // Is user dragging the platform
        mouseDown: false            // Is mouse button held down
    };

    // DOM Elements
    const elements = {
        canvas: document.getElementById('game-canvas'),
        gameArea: document.getElementById('gameArea'),
        scoreDisplay: document.getElementById('scoreDisplay'),
        blocksDisplay: document.getElementById('blocksDisplay'),
        instructions: document.getElementById('instructions'),
        gameOverModal: document.getElementById('gameOverModal'),
        finalScore: document.getElementById('finalScore'),
        finalBlocks: document.getElementById('finalBlocks'),
        playerRank: document.getElementById('playerRank'),
        restartBtn: document.getElementById('restartBtn'),
        playAgainBtn: document.getElementById('playAgainBtn')
    };

    // Color palettes
    const COLORS = {
        background: '#0a1628',
        platform: '#1e40af',
        platformBorder: '#60a5fa',
        platformGlow: '#3b82f6',
        block: [
            '#e0f2fe',
            '#bae6fd',
            '#7dd3fc',
            '#38bdf8',
            '#0ea5e9',
            '#0284c7'
        ],
        walls: '#0d2137',
        heightBar: '#22c55e',
        heightBarBg: 'rgba(255,255,255,0.1)'
    };

    // Initialize the game
    function init() {
        setupCanvas();
        createEngine();
        createWorld();
        setupEventListeners();
        initSnowflakes();
        initDecorations();
        startGameLoop();

        // Center mouse initially
        state.mouseX = state.canvasWidth / 2;
        state.platformTargetX = state.canvasWidth / 2;
        state.platformLastX = state.canvasWidth / 2;

        // Initialize sound system
        SoundSystem.init();
    }

    // ============================================
    // SNOWFLAKE SYSTEM
    // ============================================
    function initSnowflakes() {
        state.snowflakes = [];
        for (let i = 0; i < CONFIG.snowflakeCount; i++) {
            state.snowflakes.push(createSnowflake(true));
        }
    }

    function createSnowflake(randomY = false) {
        return {
            x: Math.random() * state.canvasWidth,
            y: randomY ? Math.random() * state.canvasHeight : -10,
            size: 2 + Math.random() * 4,
            speed: 0.5 + Math.random() * 1.5,
            wobble: Math.random() * Math.PI * 2,
            wobbleSpeed: 0.02 + Math.random() * 0.03,
            opacity: 0.3 + Math.random() * 0.7
        };
    }

    function updateSnowflakes() {
        state.snowflakes.forEach(flake => {
            flake.y += flake.speed;
            flake.wobble += flake.wobbleSpeed;
            flake.x += Math.sin(flake.wobble) * 0.5;

            // Reset if off screen
            if (flake.y > state.canvasHeight + 10) {
                flake.y = -10;
                flake.x = Math.random() * state.canvasWidth;
            }
            if (flake.x < -10) flake.x = state.canvasWidth + 10;
            if (flake.x > state.canvasWidth + 10) flake.x = -10;
        });
    }

    function drawSnowflakes(ctx) {
        ctx.save();
        state.snowflakes.forEach(flake => {
            ctx.beginPath();
            ctx.arc(flake.x, flake.y, flake.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${flake.opacity})`;
            ctx.fill();
        });
        ctx.restore();
    }

    // ============================================
    // DECORATIONS SYSTEM (Trees, presents, etc.)
    // ============================================
    function initDecorations() {
        state.decorations = [];
        const types = ['tree', 'smallTree', 'present', 'candycane', 'snowman'];

        // Spread decorations evenly across the bottom
        const spacing = state.canvasWidth / (CONFIG.decorationCount + 1);

        for (let i = 0; i < CONFIG.decorationCount; i++) {
            const type = types[i % types.length]; // Cycle through types
            const baseX = spacing * (i + 1);
            state.decorations.push({
                type: type,
                x: baseX + (Math.random() - 0.5) * 30, // Small random offset
                y: state.canvasHeight - 25 - Math.random() * 15,
                scale: 0.6 + Math.random() * 0.3
            });
        }
        // Sort by y so further ones are behind
        state.decorations.sort((a, b) => a.y - b.y);
    }

    function drawDecorations(ctx) {
        ctx.save();
        state.decorations.forEach(dec => {
            ctx.save();
            ctx.translate(dec.x, dec.y);
            ctx.scale(dec.scale, dec.scale);

            switch(dec.type) {
                case 'tree':
                    drawTree(ctx, 40);
                    break;
                case 'smallTree':
                    drawTree(ctx, 25);
                    break;
                case 'present':
                    drawPresent(ctx);
                    break;
                case 'candycane':
                    drawCandyCane(ctx);
                    break;
                case 'snowman':
                    drawSnowman(ctx);
                    break;
            }
            ctx.restore();
        });
        ctx.restore();
    }

    function drawTree(ctx, size) {
        const time = performance.now() / 1000; // Time in seconds for animation

        // Trunk
        ctx.fillStyle = '#5D4037';
        ctx.fillRect(-4, 0, 8, 15);

        // Tree layers (darker green)
        ctx.fillStyle = '#1B5E20';
        ctx.beginPath();
        ctx.moveTo(0, -size);
        ctx.lineTo(-size * 0.6, 0);
        ctx.lineTo(size * 0.6, 0);
        ctx.closePath();
        ctx.fill();

        // Second layer (lighter)
        ctx.fillStyle = '#2E7D32';
        ctx.beginPath();
        ctx.moveTo(0, -size * 0.7);
        ctx.lineTo(-size * 0.5, size * 0.1);
        ctx.lineTo(size * 0.5, size * 0.1);
        ctx.closePath();
        ctx.fill();

        // Animated star on top (pulsing glow)
        const starPulse = 0.8 + Math.sin(time * 3) * 0.2;
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(0, -size, 5 * starPulse, 0, Math.PI * 2);
        ctx.fill();

        // Animated ornaments with twinkling effect
        const ornaments = [
            { x: -size * 0.25, y: -size * 0.2, baseColor: [239, 68, 68], phase: 0 },     // Red
            { x: size * 0.2, y: -size * 0.35, baseColor: [59, 130, 246], phase: 1 },    // Blue
            { x: -size * 0.1, y: -size * 0.55, baseColor: [251, 191, 36], phase: 2 },   // Yellow
            { x: size * 0.15, y: -size * 0.15, baseColor: [16, 185, 129], phase: 3 },   // Green
            { x: -size * 0.35, y: -size * 0.4, baseColor: [168, 85, 247], phase: 4 }    // Purple
        ];

        ornaments.forEach(orn => {
            // Twinkle effect - varies brightness over time
            const twinkle = 0.7 + Math.sin(time * 2 + orn.phase) * 0.3;
            const [r, g, b] = orn.baseColor;
            ctx.fillStyle = `rgb(${Math.floor(r * twinkle)}, ${Math.floor(g * twinkle)}, ${Math.floor(b * twinkle)})`;
            ctx.beginPath();
            ctx.arc(orn.x, orn.y, 3, 0, Math.PI * 2);
            ctx.fill();

            // Small highlight
            ctx.fillStyle = `rgba(255, 255, 255, ${0.3 + twinkle * 0.3})`;
            ctx.beginPath();
            ctx.arc(orn.x - 1, orn.y - 1, 1, 0, Math.PI * 2);
            ctx.fill();
        });

        // Tinsel/garland effect
        ctx.strokeStyle = 'rgba(255, 215, 0, 0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-size * 0.4, -size * 0.15);
        ctx.quadraticCurveTo(0, -size * 0.3, size * 0.4, -size * 0.15);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-size * 0.3, -size * 0.45);
        ctx.quadraticCurveTo(0, -size * 0.55, size * 0.3, -size * 0.45);
        ctx.stroke();
    }

    function drawPresent(ctx) {
        // Box
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(-12, -15, 24, 20);

        // Ribbon vertical
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(-2, -15, 4, 20);

        // Ribbon horizontal
        ctx.fillRect(-12, -8, 24, 4);

        // Bow
        ctx.beginPath();
        ctx.arc(-4, -15, 4, 0, Math.PI * 2);
        ctx.arc(4, -15, 4, 0, Math.PI * 2);
        ctx.fill();
    }

    function drawCandyCane(ctx) {
        // Red base of candy cane
        ctx.strokeStyle = '#dc2626';
        ctx.lineWidth = 8;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Main stick with curved top
        ctx.beginPath();
        ctx.moveTo(0, 10);
        ctx.lineTo(0, -15);
        ctx.quadraticCurveTo(0, -28, 12, -28);
        ctx.stroke();

        // White stripes (alternating)
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        // Vertical stripes on stick
        for (let i = 0; i < 5; i++) {
            ctx.beginPath();
            ctx.moveTo(-3, 8 - i * 6);
            ctx.lineTo(3, 5 - i * 6);
            ctx.stroke();
        }
        // Stripe on curve
        ctx.beginPath();
        ctx.arc(6, -22, 6, Math.PI * 0.5, Math.PI * 1.2);
        ctx.stroke();
    }

    function drawSnowman(ctx) {
        // Bottom ball
        ctx.fillStyle = '#f8fafc';
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Middle ball
        ctx.beginPath();
        ctx.arc(0, -16, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Head
        ctx.beginPath();
        ctx.arc(0, -28, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Eyes
        ctx.fillStyle = '#1f2937';
        ctx.beginPath();
        ctx.arc(-2, -30, 1.5, 0, Math.PI * 2);
        ctx.arc(2, -30, 1.5, 0, Math.PI * 2);
        ctx.fill();

        // Nose (carrot)
        ctx.fillStyle = '#f97316';
        ctx.beginPath();
        ctx.moveTo(0, -28);
        ctx.lineTo(6, -27);
        ctx.lineTo(0, -26);
        ctx.closePath();
        ctx.fill();

        // Hat
        ctx.fillStyle = '#1f2937';
        ctx.fillRect(-6, -40, 12, 8);
        ctx.fillRect(-8, -33, 16, 3);
    }

    // Screen shake effect
    function triggerScreenShake(intensity = CONFIG.screenShakeIntensity) {
        state.screenShake = {
            x: 0,
            y: 0,
            intensity: intensity,
            duration: CONFIG.screenShakeDuration,
            startTime: performance.now()
        };
    }

    function updateScreenShake() {
        if (state.screenShake.duration <= 0) return;

        const elapsed = performance.now() - state.screenShake.startTime;
        if (elapsed >= state.screenShake.duration) {
            state.screenShake.duration = 0;
            state.screenShake.x = 0;
            state.screenShake.y = 0;
            elements.canvas.style.transform = '';
            return;
        }

        const progress = elapsed / state.screenShake.duration;
        const decay = 1 - progress;
        const intensity = state.screenShake.intensity * decay;

        state.screenShake.x = (Math.random() - 0.5) * 2 * intensity;
        state.screenShake.y = (Math.random() - 0.5) * 2 * intensity;

        elements.canvas.style.transform = `translate(${state.screenShake.x}px, ${state.screenShake.y}px)`;
    }

    // Setup canvas dimensions
    function setupCanvas() {
        const rect = elements.gameArea.getBoundingClientRect();
        state.canvasWidth = rect.width;
        state.canvasHeight = rect.height;

        elements.canvas.width = state.canvasWidth;
        elements.canvas.height = state.canvasHeight;
    }

    // Create Matter.js engine
    function createEngine() {
        state.engine = Engine.create({
            gravity: { x: 0, y: CONFIG.gravity },
            positionIterations: 10,   // More iterations for better collision (default 6)
            velocityIterations: 8,    // More iterations for better physics (default 4)
            constraintIterations: 4
        });

        state.engine.timing.timeScale = CONFIG.timeScale;

        state.render = Render.create({
            canvas: elements.canvas,
            engine: state.engine,
            options: {
                width: state.canvasWidth,
                height: state.canvasHeight,
                wireframes: false,
                background: COLORS.background,
                pixelRatio: window.devicePixelRatio || 1
            }
        });

        state.runner = Runner.create({
            delta: 1000 / 60,  // Target 60fps
            isFixed: true      // Fixed timestep for consistent physics
        });
    }

    // Create game world
    function createWorld() {
        const centerX = state.canvasWidth / 2;
        const platformY = state.canvasHeight - CONFIG.platformBaseY;

        // Create MOVEABLE platform with raised edges (compound body)
        const platformBase = Bodies.rectangle(
            0, 0,
            CONFIG.platformWidth,
            CONFIG.platformHeight,
            {
                label: 'platform_base',
                render: {
                    fillStyle: COLORS.platform,
                    strokeStyle: COLORS.platformBorder,
                    lineWidth: 3
                },
                chamfer: { radius: 4 }
            }
        );

        // Left bumper (raised edge) - at far left edge
        const leftBumper = Bodies.rectangle(
            -CONFIG.platformWidth / 2 - 3, -12,
            10, 20,
            {
                label: 'platform_bumper',
                render: {
                    fillStyle: '#3b82f6',
                    strokeStyle: '#60a5fa',
                    lineWidth: 2
                },
                chamfer: { radius: 2 }
            }
        );

        // Right bumper (raised edge) - at far right edge
        const rightBumper = Bodies.rectangle(
            CONFIG.platformWidth / 2 + 3, -12,
            10, 20,
            {
                label: 'platform_bumper',
                render: {
                    fillStyle: '#3b82f6',
                    strokeStyle: '#60a5fa',
                    lineWidth: 2
                },
                chamfer: { radius: 2 }
            }
        );

        // Create compound body for platform
        state.platform = Body.create({
            parts: [platformBase, leftBumper, rightBumper],
            isStatic: true,
            label: 'platform'
        });

        Body.setPosition(state.platform, { x: centerX, y: platformY });

        state.platformTargetX = centerX;

        // Create walls
        const wallThickness = 50;
        const leftWall = Bodies.rectangle(
            -wallThickness / 2,
            state.canvasHeight / 2,
            wallThickness,
            state.canvasHeight * 2,
            {
                isStatic: true,
                label: 'wall',
                render: { fillStyle: COLORS.walls }
            }
        );

        const rightWall = Bodies.rectangle(
            state.canvasWidth + wallThickness / 2,
            state.canvasHeight / 2,
            wallThickness,
            state.canvasHeight * 2,
            {
                isStatic: true,
                label: 'wall',
                render: { fillStyle: COLORS.walls }
            }
        );

        // Floor sensor
        const floor = Bodies.rectangle(
            state.canvasWidth / 2,
            state.canvasHeight + 100,
            state.canvasWidth * 2,
            50,
            {
                isStatic: true,
                label: 'floor',
                isSensor: true,
                render: { visible: false }
            }
        );

        Composite.add(state.engine.world, [state.platform, leftWall, rightWall, floor]);
    }

    // Setup event listeners
    function setupEventListeners() {
        // Mouse controls - click and drag to move platform
        elements.canvas.addEventListener('mousedown', handleMouseDown);
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        // Touch controls - drag to move platform
        elements.canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
        document.addEventListener('touchmove', handleTouchMove, { passive: false });
        document.addEventListener('touchend', handleTouchEnd);

        // Restart buttons
        elements.restartBtn.addEventListener('click', restartGame);
        elements.playAgainBtn.addEventListener('click', restartGame);

        // Window resize
        window.addEventListener('resize', handleResize);

        // Collision detection
        Events.on(state.engine, 'collisionStart', handleCollision);
        Events.on(state.engine, 'collisionEnd', handleCollisionEnd);
    }

    // Handle collision end - make blocks non-sticky when detached from stack
    function handleCollisionEnd(event) {
        const pairs = event.pairs;

        pairs.forEach(pair => {
            const { bodyA, bodyB } = pair;

            // Check if a stacked block lost contact with the platform or another block
            if (isBlock(bodyA) && bodyA.hasLanded) {
                checkBlockDetachment(bodyA);
            }
            if (isBlock(bodyB) && bodyB.hasLanded) {
                checkBlockDetachment(bodyB);
            }
        });
    }

    // Check if a block is detached from the stack and make it non-sticky
    function checkBlockDetachment(block) {
        // Skip locked blocks - they should remain stable
        if (state.lockedBlocks.has(block.id)) return;

        const platformTop = state.platform.position.y - CONFIG.platformHeight / 2;
        const platformLeft = state.platform.position.x - CONFIG.platformWidth / 2;
        const platformRight = state.platform.position.x + CONFIG.platformWidth / 2;

        // Check if block is still above/on platform area
        const blockX = block.position.x;
        const blockBottom = block.bounds.max.y;
        const isAbovePlatform = blockX >= platformLeft - 50 &&
                                blockX <= platformRight + 50 &&
                                blockBottom <= platformTop + 100;

        // Check if block is touching any other stacked block
        let touchingStack = false;
        for (const otherBlock of state.stackedBlocks) {
            if (otherBlock === block) continue;
            const bounds = block.bounds;
            const otherBounds = otherBlock.bounds;

            // Simple AABB overlap check with tolerance
            const touching = !(bounds.max.x < otherBounds.min.x - 5 ||
                             bounds.min.x > otherBounds.max.x + 5 ||
                             bounds.max.y < otherBounds.min.y - 5 ||
                             bounds.min.y > otherBounds.max.y + 5);
            if (touching) {
                touchingStack = true;
                break;
            }
        }

        // If block is not above platform and not touching any other blocks, make it non-sticky
        if (!isAbovePlatform && !touchingStack) {
            // Reduce friction so it slides off
            block.friction = 0.1;
            block.frictionStatic = 0.2;
            block.frictionAir = 0.01;
        }
    }

    // Handle mouse movement - controls platform (only when dragging or mouse is down)
    function handleMouseMove(e) {
        if (!state.isDragging && !state.mouseDown) return;
        const rect = elements.canvas.getBoundingClientRect();
        state.mouseX = e.clientX - rect.left;
        state.platformTargetX = state.mouseX;
    }

    // Handle mouse down - start dragging
    function handleMouseDown(e) {
        state.mouseDown = true;
        state.isDragging = true;
        const rect = elements.canvas.getBoundingClientRect();
        state.mouseX = e.clientX - rect.left;
        state.platformTargetX = state.mouseX;

        if (!state.gameStarted) {
            handleStart();
        }
    }

    // Handle mouse up - stop dragging
    function handleMouseUp(e) {
        state.mouseDown = false;
        state.isDragging = false;
    }

    // Handle touch movement
    function handleTouchMove(e) {
        e.preventDefault();
        if (e.touches.length > 0 && state.isDragging) {
            const rect = elements.canvas.getBoundingClientRect();
            state.mouseX = e.touches[0].clientX - rect.left;
            state.platformTargetX = state.mouseX;
        }
    }

    // Handle touch start - start dragging
    function handleTouchStart(e) {
        e.preventDefault();
        state.isDragging = true;
        if (e.touches.length > 0) {
            const rect = elements.canvas.getBoundingClientRect();
            state.mouseX = e.touches[0].clientX - rect.left;
            state.platformTargetX = state.mouseX;
        }
        if (!state.gameStarted) {
            handleStart();
        }
    }

    // Handle touch end - stop dragging
    function handleTouchEnd(e) {
        state.isDragging = false;
    }

    // Handle game start
    function handleStart() {
        if (state.gameStarted || state.isGameOver) return;

        state.gameStarted = true;
        elements.instructions.classList.add('hidden');

        // Start ambient sounds (music is now in global jukebox)
        SoundSystem.resume();
        SoundSystem.startAmbientWind();

        // Start dropping blocks
        spawnNextBlock();
    }

    // Update platform position (follows mouse/touch) with momentum transfer
    function updatePlatform() {
        if (!state.platform) return;

        const currentX = state.platform.position.x;
        const targetX = state.platformTargetX;

        // Smooth movement towards target
        const newX = currentX + (targetX - currentX) * CONFIG.platformSpeed;

        // Clamp to bounds
        const halfWidth = CONFIG.platformWidth / 2;
        const clampedX = Math.max(halfWidth + 5, Math.min(state.canvasWidth - halfWidth - 5, newX));

        // Calculate platform velocity for momentum transfer
        state.platformVelocity = clampedX - state.platformLastX;
        state.platformLastX = clampedX;

        Body.setPosition(state.platform, {
            x: clampedX,
            y: state.platform.position.y
        });

        // Transfer momentum to blocks resting on platform
        if (Math.abs(state.platformVelocity) > 0.1) {
            transferMomentumToStack();
        }
    }

    // Transfer platform momentum to stacked blocks (glued - move with platform)
    function transferMomentumToStack() {
        if (Math.abs(state.platformVelocity) < 0.01) return; // No movement

        const platformTop = state.platform.position.y - CONFIG.platformHeight / 2;
        const platformLeft = state.platform.position.x - CONFIG.platformWidth / 2;
        const platformRight = state.platform.position.x + CONFIG.platformWidth / 2;

        state.stackedBlocks.forEach(block => {
            const blockX = block.position.x;

            // Check if block is above platform area (stacked)
            const isAbovePlatform = blockX >= platformLeft - 20 &&
                                    blockX <= platformRight + 20 &&
                                    block.position.y < platformTop + 50;

            if (isAbovePlatform) {
                // GLUE: Move block position directly with platform
                Body.setPosition(block, {
                    x: block.position.x + state.platformVelocity,
                    y: block.position.y
                });

                // Don't add velocity - position change is enough
                // This prevents momentum buildup that causes blocks to fly off
            }
        });
    }

    // Stabilize stacked blocks by damping their velocities
    function stabilizeStack() {
        state.stackedBlocks.forEach(block => {
            // Dampen horizontal velocity significantly for stability
            if (Math.abs(block.velocity.x) > 0.5) {
                Body.setVelocity(block, {
                    x: block.velocity.x * 0.85,
                    y: block.velocity.y
                });
            }

            // Dampen angular velocity
            if (Math.abs(block.angularVelocity) > 0.01) {
                Body.setAngularVelocity(block, block.angularVelocity * 0.9);
            }
        });
    }

    // Lock blocks every N stacked (makes them resistant to knockback)
    function checkStackLock() {
        const lockThreshold = Math.floor(state.blocksStacked / CONFIG.lockEveryNBlocks);

        if (lockThreshold > state.lastLockCount && state.blocksStacked >= CONFIG.lockEveryNBlocks) {
            state.lastLockCount = lockThreshold;

            // Lock all currently stacked blocks
            state.stackedBlocks.forEach(block => {
                if (!state.lockedBlocks.has(block.id)) {
                    state.lockedBlocks.add(block.id);

                    // Visual feedback - add golden glow
                    block.render.strokeStyle = '#fbbf24';
                    block.render.lineWidth = 3;

                    // Make block heavier and much more stable
                    Body.setMass(block, block.mass * 2.0);
                    block.friction = 1.0;
                    block.frictionStatic = 2.0;  // Very high static friction
                    block.frictionAir = 0.1;     // More air resistance

                    // Kill any remaining velocity when locked
                    Body.setVelocity(block, { x: 0, y: 0 });
                    Body.setAngularVelocity(block, 0);
                }
            });

            // Play lock sound and visual effect
            SoundSystem.playLock();
            triggerScreenShake(5);
        }
    }

    // Calculate current stack height
    function calculateStackHeight() {
        if (state.stackedBlocks.length === 0) {
            state.currentHeight = 0;
            return;
        }

        const platformTop = state.platform.position.y - CONFIG.platformHeight / 2;
        let highestPoint = platformTop;

        state.stackedBlocks.forEach(block => {
            const blockBounds = block.bounds;
            if (blockBounds.min.y < highestPoint) {
                highestPoint = blockBounds.min.y;
            }
        });

        // Height in pixels from platform top
        const heightPx = platformTop - highestPoint;
        state.currentHeight = Math.max(0, Math.round(heightPx));

        if (state.currentHeight > state.maxHeight) {
            state.maxHeight = state.currentHeight;
        }

        updateDisplay();
    }

    // Handle collision events
    function handleCollision(event) {
        const pairs = event.pairs;

        pairs.forEach(pair => {
            const { bodyA, bodyB } = pair;

            // Block landing on platform or stack
            if (isCurrentBlock(bodyA) && isPlatformOrStackedBlock(bodyB)) {
                handleBlockLanded(bodyA);
            } else if (isCurrentBlock(bodyB) && isPlatformOrStackedBlock(bodyA)) {
                handleBlockLanded(bodyB);
            }

            // Projectile hitting blocks
            if (isProjectile(bodyA) && isBlock(bodyB)) {
                handleProjectileHit(bodyA, bodyB);
            } else if (isProjectile(bodyB) && isBlock(bodyA)) {
                handleProjectileHit(bodyB, bodyA);
            }

            // Projectile hitting platform - LOSE A LIFE
            if (isProjectile(bodyA) && isPlatformBody(bodyB)) {
                handlePlatformHit(bodyA);
            } else if (isProjectile(bodyB) && isPlatformBody(bodyA)) {
                handlePlatformHit(bodyB);
            }

            // Bodies falling off
            if (isFloor(bodyA) || isFloor(bodyB)) {
                const fallenBody = isFloor(bodyA) ? bodyB : bodyA;
                handleBodyFallen(fallenBody);
            }
        });
    }

    function isCurrentBlock(body) {
        return body === state.currentBlock && !body.hasLanded;
    }

    function isBlock(body) {
        return body.label && body.label.startsWith('block');
    }

    function isProjectile(body) {
        return body.label && body.label.startsWith('projectile_');
    }

    function isPlatformOrStackedBlock(body) {
        // Check for platform (including compound body parts)
        const isPlatform = body.label === 'platform' ||
                          body.label === 'platform_base' ||
                          body.label === 'platform_bumper';
        return isPlatform || (isBlock(body) && body.hasLanded);
    }

    function isPlatformBody(body) {
        return body.label === 'platform' ||
               body.label === 'platform_base' ||
               body.label === 'platform_bumper';
    }

    function isFloor(body) {
        return body.label === 'floor';
    }

    // Handle platform being hit by projectile
    function handlePlatformHit(projectile) {
        // Remove the projectile
        scheduleProjectileRemoval(projectile);

        // Skip if invulnerable
        if (state.isInvulnerable || state.isGameOver) return;

        // Lose a life
        state.lives--;
        SoundSystem.playLoseLife();
        triggerScreenShake(12);

        // Flash platform red
        const originalColor = state.platform.render.fillStyle;
        state.platform.render.fillStyle = '#ef4444';

        // Brief invulnerability
        state.isInvulnerable = true;

        // Flash effect
        let flashes = 0;
        const flashInterval = setInterval(() => {
            flashes++;
            state.platform.render.fillStyle = flashes % 2 === 0 ? '#ef4444' : originalColor;
            if (flashes >= 6) {
                clearInterval(flashInterval);
                state.platform.render.fillStyle = originalColor;
                state.isInvulnerable = false;
            }
        }, 150);

        // Check for game over
        if (state.lives <= 0) {
            setTimeout(() => endGame(), 500);
        }
    }

    // Handle block landing
    function handleBlockLanded(block) {
        if (block.hasLanded) return;
        block.hasLanded = true;

        // Make block sticky when landed - high friction for stability
        block.friction = 0.99;
        block.frictionStatic = 1.0;
        block.frictionAir = 0.05;  // More air drag to settle faster

        // Kill most horizontal velocity on landing for stability
        Body.setVelocity(block, {
            x: block.velocity.x * 0.3,
            y: block.velocity.y * 0.5
        });

        // Reduce angular velocity
        Body.setAngularVelocity(block, block.angularVelocity * 0.3);

        if (!state.stackedBlocks.includes(block)) {
            state.stackedBlocks.push(block);
            state.blocksStacked++;
            calculateStackHeight();

            // Check if we should lock the stack
            checkStackLock();

            // Play landing sound with intensity based on block size
            const sizeIndex = Math.min(state.blocksDropped - 1, CONFIG.blockSizes.length - 1);
            const intensity = 1 - (sizeIndex / CONFIG.blockSizes.length) * 0.5;
            SoundSystem.playLanding(intensity);

            // Play stack success sound
            SoundSystem.playStack(state.currentHeight);

            // Small screen shake on landing
            triggerScreenShake(3 + intensity * 3);
        }

        state.currentBlock = null;
        state.waitingForSettle = true;

        setTimeout(() => {
            state.waitingForSettle = false;
            if (!state.isGameOver) {
                if (state.blocksDropped > 0 && state.blocksDropped % CONFIG.projectileFrequency === 0) {
                    spawnProjectiles();
                } else {
                    spawnNextBlock();
                }
            }
        }, CONFIG.autoDropDelay);
    }

    // Handle projectile hitting a block
    function handleProjectileHit(projectile, block) {
        const projType = projectile.projectileType || 'coal';
        const config = PROJECTILES[projType] || PROJECTILES.coal;

        const direction = block.position.x > projectile.position.x ? 1 : -1;
        let force = config.impactForce * 0.6; // Reduced base force

        // Locked blocks take greatly reduced knockback
        const isLocked = state.lockedBlocks.has(block.id);
        if (isLocked) {
            force *= 0.15; // 85% reduction for locked blocks
        }

        // Stacked blocks also get reduced knockback
        if (block.hasLanded) {
            force *= 0.5; // 50% reduction for any landed block
        }

        // Apply force (reduced multipliers)
        Body.applyForce(block, block.position, {
            x: direction * force * block.mass * 0.8,
            y: -force * block.mass * 0.15
        });

        // Add minimal spin (much less for stability)
        Body.setAngularVelocity(block, (Math.random() - 0.5) * (isLocked ? 0.02 : 0.06));

        // Play impact sound and screen shake
        SoundSystem.playImpact(projType);
        triggerScreenShake(isLocked ? 4 : CONFIG.screenShakeIntensity);

        // Visual flash (golden for locked blocks)
        const originalColor = block.render.fillStyle;
        block.render.fillStyle = isLocked ? '#fbbf24' : '#ef4444';
        setTimeout(() => {
            if (block.render) block.render.fillStyle = originalColor;
        }, 150);

        scheduleProjectileRemoval(projectile);
    }

    function scheduleProjectileRemoval(projectile) {
        setTimeout(() => {
            if (state.projectiles.includes(projectile)) {
                Composite.remove(state.engine.world, projectile);
                const idx = state.projectiles.indexOf(projectile);
                if (idx > -1) state.projectiles.splice(idx, 1);
            }
        }, 400);
    }

    // Handle body falling off screen
    function handleBodyFallen(body) {
        if (isBlock(body)) {
            // Check if this was a stacked block (had landed previously)
            const wasStacked = body.hasLanded === true;
            const index = state.stackedBlocks.indexOf(body);

            if (index > -1) {
                state.stackedBlocks.splice(index, 1);
                state.blocksStacked = Math.max(0, state.blocksStacked - 1);
                calculateStackHeight();
            }

            // Remove from physics world first
            Composite.remove(state.engine.world, body);

            // GAME OVER if a stacked block falls off (after first block has landed)
            if (wasStacked && state.blocksDropped >= 1 && !state.isGameOver) {
                SoundSystem.playLoseLife();
                triggerScreenShake(15);
                setTimeout(() => {
                    if (!state.isGameOver) endGame();
                }, 100);
                return;
            }

            // Also game over if all blocks gone after playing a while
            if (state.blocksStacked === 0 && state.blocksDropped > 2 && !state.waitingForSettle && !state.currentBlock && !state.isGameOver) {
                endGame();
                return;
            }
            return;
        }

        Composite.remove(state.engine.world, body);

        if (isProjectile(body)) {
            const idx = state.projectiles.indexOf(body);
            if (idx > -1) state.projectiles.splice(idx, 1);
        }
    }

    // Spawn the next block (auto-drops from random position)
    function spawnNextBlock() {
        if (state.isGameOver || state.currentBlock) return;

        state.blocksDropped++;

        const sizeIndex = Math.min(state.blocksDropped - 1, CONFIG.blockSizes.length - 1);
        const blockSize = CONFIG.blockSizes[sizeIndex];

        // Random X position for the block
        const halfWidth = blockSize.width / 2;
        const minX = halfWidth + 30;
        const maxX = state.canvasWidth - halfWidth - 30;
        const startX = minX + Math.random() * (maxX - minX);

        const colorIndex = Math.min(Math.floor(state.blocksDropped / 2), COLORS.block.length - 1);

        state.currentBlock = Bodies.rectangle(
            startX,
            40,
            blockSize.width,
            blockSize.height,
            {
                label: `block_${state.blocksDropped}`,
                friction: CONFIG.friction,
                restitution: CONFIG.restitution,
                frictionAir: 0.01,
                render: {
                    fillStyle: COLORS.block[colorIndex],
                    strokeStyle: 'rgba(255,255,255,0.4)',
                    lineWidth: 2
                },
                chamfer: { radius: 4 }
            }
        );

        state.currentBlock.hasLanded = false;
        Composite.add(state.engine.world, state.currentBlock);
    }

    // Spawn projectiles from ceiling with enhanced visuals
    function spawnProjectiles() {
        if (state.isGameOver) return;

        // Play warning sound for incoming projectiles
        SoundSystem.playProjectileSpawn();

        // More projectiles as game progresses - scales up significantly
        const baseCount = CONFIG.projectileBaseCount;
        const scaling = Math.floor(state.blocksDropped / 3);
        const count = Math.min(baseCount + scaling, CONFIG.projectileMaxCount);

        for (let i = 0; i < count; i++) {
            setTimeout(() => {
                if (state.isGameOver) return;

                // Pick random projectile type
                const type = CONFIG.projectileTypes[Math.floor(Math.random() * CONFIG.projectileTypes.length)];
                const config = PROJECTILES[type];

                // Play individual launch sound for this projectile
                SoundSystem.playProjectileLaunch(type);

                // Speed increases with game progress
                const speedMultiplier = 1 + (state.blocksDropped * 0.04);

                // ALL projectiles spawn from the ceiling now
                const margin = config.size * 2;
                const x = margin + Math.random() * (state.canvasWidth - margin * 2);
                const y = -config.size - 10;

                // Random horizontal drift + downward velocity
                const vx = (Math.random() - 0.5) * 4 * speedMultiplier;
                const vy = (2 + Math.random() * 2.5) * speedMultiplier;

                let projectile;
                const renderOptions = {
                    fillStyle: config.color,
                    strokeStyle: config.borderColor,
                    lineWidth: 2
                };

                // Create projectile based on shape type
                if (config.shape === 'polygon') {
                    const sides = config.sides || (5 + Math.floor(Math.random() * 3));
                    projectile = Bodies.polygon(x, y, sides, config.size, {
                        label: `projectile_${type}`,
                        projectileType: type,
                        friction: 0.3,
                        restitution: config.restitution,
                        density: config.density,
                        render: renderOptions
                    });
                } else if (config.shape === 'triangle') {
                    // Icicle - pointed triangle
                    projectile = Bodies.polygon(x, y, 3, config.size, {
                        label: `projectile_${type}`,
                        projectileType: type,
                        friction: 0.3,
                        restitution: config.restitution,
                        density: config.density,
                        render: renderOptions
                    });
                } else if (config.shape === 'rectangle') {
                    // Rectangle shapes (candycane, giftbox)
                    const width = type === 'giftbox' ? config.size * 1.2 : config.size * 0.5;
                    const height = type === 'giftbox' ? config.size * 1.2 : config.size * 2.5;
                    projectile = Bodies.rectangle(x, y, width, height, {
                        label: `projectile_${type}`,
                        projectileType: type,
                        friction: 0.3,
                        restitution: config.restitution,
                        density: config.density,
                        render: renderOptions,
                        chamfer: type === 'giftbox' ? { radius: 2 } : undefined
                    });
                } else {
                    // Circle shapes (default)
                    projectile = Bodies.circle(x, y, config.size, {
                        label: `projectile_${type}`,
                        projectileType: type,
                        friction: 0.3,
                        restitution: config.restitution,
                        density: config.density,
                        render: renderOptions
                    });
                }

                // Store effect configuration on the projectile
                projectile.effectConfig = config;

                // Set velocity based on spawn position
                Body.setVelocity(projectile, { x: vx, y: vy });

                // Add spin - more for stars and decorative items
                const spinAmount = config.spin ? 0.3 : 0.15;
                Body.setAngularVelocity(projectile, (Math.random() - 0.5) * spinAmount);

                state.projectiles.push(projectile);
                Composite.add(state.engine.world, projectile);
            }, i * 180);
        }

        // Spawn next block after projectile rain
        setTimeout(() => {
            if (!state.isGameOver && !state.currentBlock) {
                spawnNextBlock();
            }
        }, 400 + (count * 180));
    }

    // Draw projectile effects (trails, glows, sparkles)
    function drawProjectileEffects(ctx) {
        const now = Date.now();

        // Update and draw trails
        projectileEffects.trails = projectileEffects.trails.filter(trail => {
            trail.life -= 0.05;
            if (trail.life <= 0) return false;

            ctx.beginPath();
            ctx.arc(trail.x, trail.y, trail.size * trail.life, 0, Math.PI * 2);
            ctx.fillStyle = trail.color.replace(')', `, ${trail.life * 0.6})`).replace('rgba', 'rgba').replace('rgb', 'rgba');
            ctx.fill();
            return true;
        });

        // Update and draw sparkles
        projectileEffects.sparkles = projectileEffects.sparkles.filter(sparkle => {
            sparkle.life -= 0.08;
            if (sparkle.life <= 0) return false;

            sparkle.x += sparkle.vx;
            sparkle.y += sparkle.vy;
            sparkle.vy += 0.1; // gravity

            ctx.save();
            ctx.beginPath();
            ctx.arc(sparkle.x, sparkle.y, sparkle.size * sparkle.life, 0, Math.PI * 2);
            ctx.fillStyle = sparkle.color;
            ctx.shadowColor = sparkle.color;
            ctx.shadowBlur = 5;
            ctx.fill();
            ctx.restore();
            return true;
        });

        // Draw effects for each projectile
        state.projectiles.forEach(proj => {
            const config = proj.effectConfig || PROJECTILES[proj.projectileType];
            if (!config) return;

            const x = proj.position.x;
            const y = proj.position.y;

            // Add trail particles
            if (config.trail && Math.random() > 0.5) {
                projectileEffects.trails.push({
                    x: x + (Math.random() - 0.5) * 5,
                    y: y + (Math.random() - 0.5) * 5,
                    size: config.size * 0.4,
                    color: config.trailColor || config.glowColor,
                    life: 1
                });
            }

            // Add sparkles for sparkly projectiles
            if (config.sparkle && Math.random() > 0.7) {
                projectileEffects.sparkles.push({
                    x: x + (Math.random() - 0.5) * config.size,
                    y: y + (Math.random() - 0.5) * config.size,
                    vx: (Math.random() - 0.5) * 2,
                    vy: (Math.random() - 0.5) * 2,
                    size: 3 + Math.random() * 2,
                    color: config.particleColor,
                    life: 1
                });
            }

            // Draw glow effect
            if (config.glowColor) {
                ctx.save();
                ctx.beginPath();
                ctx.arc(x, y, config.size * 1.5, 0, Math.PI * 2);
                ctx.fillStyle = config.glowColor;
                ctx.shadowColor = config.glowColor;
                ctx.shadowBlur = 15;
                ctx.fill();
                ctx.restore();
            }

            // Draw special decorations for certain types
            if (config.stripes && proj.projectileType === 'candycane') {
                // Draw candy cane stripes
                ctx.save();
                ctx.translate(x, y);
                ctx.rotate(proj.angle);
                for (let i = -3; i <= 3; i++) {
                    ctx.fillStyle = i % 2 === 0 ? '#ffffff' : '#dc2626';
                    ctx.fillRect(-config.size * 0.25, i * 5 - 2, config.size * 0.5, 4);
                }
                ctx.restore();
            }

            if (config.ribbon && proj.projectileType === 'giftbox') {
                // Draw gift ribbon
                ctx.save();
                ctx.translate(x, y);
                ctx.rotate(proj.angle);
                ctx.fillStyle = '#dc2626';
                ctx.fillRect(-config.size * 0.6, -2, config.size * 1.2, 4);
                ctx.fillRect(-2, -config.size * 0.6, 4, config.size * 1.2);
                // Bow
                ctx.beginPath();
                ctx.arc(0, -config.size * 0.5, 4, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }

            if (config.shiny && proj.projectileType === 'ornament') {
                // Draw ornament shine and cap
                ctx.save();
                ctx.translate(x, y);
                // Shine
                ctx.beginPath();
                ctx.arc(-config.size * 0.3, -config.size * 0.3, config.size * 0.25, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
                ctx.fill();
                // Cap
                ctx.fillStyle = '#fbbf24';
                ctx.fillRect(-4, -config.size - 2, 8, 6);
                ctx.restore();
            }

            if (config.berries && proj.projectileType === 'mistletoe') {
                // Draw mistletoe berries
                ctx.save();
                ctx.translate(x, y);
                ctx.fillStyle = '#dc2626';
                ctx.beginPath();
                ctx.arc(-4, 4, 3, 0, Math.PI * 2);
                ctx.arc(4, 4, 3, 0, Math.PI * 2);
                ctx.arc(0, 7, 3, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
        });
    }

    // Update display (height instead of score)
    function updateDisplay() {
        // Show height instead of score
        elements.scoreDisplay.textContent = state.currentHeight;
        elements.blocksDisplay.textContent = state.blocksStacked;
    }

    // End the game
    function endGame() {
        if (state.isGameOver) return;
        state.isGameOver = true;

        // Stop music and ambient, play game over sound
        SoundSystem.stopMusic();
        SoundSystem.stopAmbientWind();
        SoundSystem.playGameOver();

        // Big screen shake
        triggerScreenShake(15);

        saveScore();

        elements.finalScore.textContent = state.maxHeight;
        elements.finalBlocks.textContent = state.blocksStacked;
        elements.gameOverModal.classList.add('active');
    }

    // Save score to server
    async function saveScore() {
        try {
            const response = await fetch('/Game/SaveScore', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    playerId: PLAYER_ID,
                    score: state.maxHeight,
                    blocksStacked: state.blocksStacked,
                    maxHeight: state.maxHeight
                })
            });

            const result = await response.json();
            if (result.success) {
                elements.playerRank.textContent = result.rank;
            }
        } catch (error) {
            console.error('Failed to save score:', error);
        }
    }

    // Restart the game
    function restartGame() {
        // Stop any playing sounds and music
        SoundSystem.stopAmbientWind();
        SoundSystem.stopMusic();

        Composite.clear(state.engine.world);

        state.currentBlock = null;
        state.stackedBlocks = [];
        state.projectiles = [];
        state.blocksDropped = 0;
        state.blocksStacked = 0;
        state.currentHeight = 0;
        state.maxHeight = 0;
        state.isGameOver = false;
        state.gameStarted = false;
        state.waitingForSettle = false;
        state.platformVelocity = 0;
        state.screenShake = { x: 0, y: 0, duration: 0, startTime: 0 };
        state.lockedBlocks = new Set();
        state.lastLockCount = 0;
        state.lives = CONFIG.maxLives;
        state.isInvulnerable = false;
        state.isDragging = false;
        state.mouseDown = false;

        // Reset canvas transform
        elements.canvas.style.transform = '';

        elements.instructions.classList.remove('hidden');
        elements.gameOverModal.classList.remove('active');
        updateDisplay();

        // Reinitialize decorations for variety
        initDecorations();

        createWorld();
        state.platformTargetX = state.canvasWidth / 2;
        state.platformLastX = state.canvasWidth / 2;
    }

    // Handle window resize
    function handleResize() {
        setupCanvas();

        if (state.render) {
            state.render.canvas.width = state.canvasWidth;
            state.render.canvas.height = state.canvasHeight;
            state.render.options.width = state.canvasWidth;
            state.render.options.height = state.canvasHeight;
        }
    }

    // Start the game loop
    function startGameLoop() {
        Render.run(state.render);
        Runner.run(state.runner, state.engine);

        // Hook into Matter.js afterRender to draw our custom elements
        Events.on(state.render, 'afterRender', function() {
            const ctx = state.render.context;

            // Draw projectile effects (trails, glows, sparkles) - behind projectiles
            drawProjectileEffects(ctx);

            // Draw decorations (behind everything else)
            drawDecorations(ctx);

            // Draw snowflakes (in front of decorations, behind UI)
            drawSnowflakes(ctx);

            // Draw UI elements
            drawLives(ctx);

            // Draw lock indicator if blocks are locked
            if (state.lockedBlocks.size > 0) {
                drawLockIndicator(ctx);
            }
        });

        function gameLoop() {
            // Always update screen shake (even during game over for effect)
            updateScreenShake();

            // Always update snowflakes
            updateSnowflakes();

            if (!state.isGameOver) {
                // Update platform position (mouse/touch controlled)
                updatePlatform();

                // Stabilize stacked blocks to prevent flying off
                if (state.stackedBlocks.length > 0) {
                    stabilizeStack();
                    calculateStackHeight();
                }

                // Check for fallen blocks
                checkFallenBlocks();
            }
            requestAnimationFrame(gameLoop);
        }

        gameLoop();
    }

    // Draw lock indicator
    function drawLockIndicator(ctx) {
        ctx.save();
        ctx.fillStyle = 'rgba(251, 191, 36, 0.8)';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'left';

        const lockedCount = state.lockedBlocks.size;
        const nextLock = CONFIG.lockEveryNBlocks - (state.blocksStacked % CONFIG.lockEveryNBlocks);

        ctx.fillText(`🔒 ${lockedCount} locked`, 10, state.canvasHeight - 10);

        if (nextLock < CONFIG.lockEveryNBlocks && nextLock > 0) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.fillText(`Next lock: ${nextLock}`, 10, state.canvasHeight - 25);
        }
        ctx.restore();
    }

    // Draw lives as hearts
    function drawLives(ctx) {
        ctx.save();
        const heartSize = 20;
        const startX = state.canvasWidth - 10 - (CONFIG.maxLives * (heartSize + 5));
        const y = 10;

        for (let i = 0; i < CONFIG.maxLives; i++) {
            const x = startX + i * (heartSize + 5);
            const isFilled = i < state.lives;

            // Draw heart shape
            ctx.beginPath();
            ctx.moveTo(x + heartSize / 2, y + heartSize * 0.3);

            // Left curve
            ctx.bezierCurveTo(
                x + heartSize / 2, y,
                x, y,
                x, y + heartSize * 0.3
            );

            // Left bottom
            ctx.bezierCurveTo(
                x, y + heartSize * 0.6,
                x + heartSize / 2, y + heartSize * 0.8,
                x + heartSize / 2, y + heartSize
            );

            // Right bottom
            ctx.bezierCurveTo(
                x + heartSize / 2, y + heartSize * 0.8,
                x + heartSize, y + heartSize * 0.6,
                x + heartSize, y + heartSize * 0.3
            );

            // Right curve
            ctx.bezierCurveTo(
                x + heartSize, y,
                x + heartSize / 2, y,
                x + heartSize / 2, y + heartSize * 0.3
            );

            ctx.closePath();

            if (isFilled) {
                ctx.fillStyle = '#ef4444';
                ctx.fill();
                ctx.strokeStyle = '#dc2626';
            } else {
                ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
                ctx.fill();
                ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
            }
            ctx.lineWidth = 2;
            ctx.stroke();
        }
        ctx.restore();
    }

    // Check for blocks that have fallen
    function checkFallenBlocks() {
        const platformY = state.platform.position.y;
        const threshold = platformY + CONFIG.fallThreshold;

        [...state.stackedBlocks].forEach(block => {
            if (block.position.y > threshold) {
                handleBodyFallen(block);
            }
        });

        [...state.projectiles].forEach(proj => {
            if (proj.position.y > state.canvasHeight + 50) {
                handleBodyFallen(proj);
            }
        });

        if (state.currentBlock && state.currentBlock.position.y > threshold) {
            handleBodyFallen(state.currentBlock);
            state.currentBlock = null;

            // Game over if any block is missed (not caught)
            if (!state.isGameOver) {
                SoundSystem.playLoseLife();
                triggerScreenShake(15);
                setTimeout(() => {
                    if (!state.isGameOver) endGame();
                }, 100);
            }
        }
    }

    // Initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
