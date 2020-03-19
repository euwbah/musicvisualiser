let system;

let synth, rhodes;
let song;
let fftSong, spectrumSong;
let fftSynth, spectrumSynth, logAvgsSynth;
let fftRhodes, spectrumRhodes, logAvgsRhodes;
let octaveBands;

// How smooth the background colour changes
// (a value of 20 means the new value will be 20 parts of
// the old value and 1 part of the new immediate value)
const BG_SMOOTHING = 12;

// Minimum spectrum amp value (0-255) before particles can generate representing that frequency
const WATERFALL_AMP_THRESH = 20;
const MELODY_AMP_THRESH_SYNTH = 130;
const MELODY_AMP_THRESH_RHODES = 160;
const BG_AMP_THRESH_SYNTH = 90;
const BG_AMP_THRESH_RHODES = 110;
const BG_TO_MELODY_DIFF_SYNTH = 60;
const BG_TO_MELODY_DIFF_RHODES = 50;

// the number of pixels in x coordinates per FFT bin (there are 1024 by default)
const FREQ_SCALE = 4;

// average energy levels
let high = 0, mid = 0, low = 0;

function preload() {
    song = loadSound('synth-action.mp3');
    synth = loadSound('synth.mp3');
    rhodes = loadSound('rhodes.mp3');
}

function mousePressed() {
    if (!synth.isPlaying()) {
        synth.play(1);
        rhodes.play(1);
        song.play(0.75);
    } else {
        let time = map(mouseX, 100, width - 100, 0, song.duration(), true);
        song.jump(time - 0.25);
        synth.jump(time);
        rhodes.jump(time);
        print(`jumped to ${time} / ${song.duration()}`);
    }
}

function setup() {
    createCanvas(1280, 720);
    background(0, 0, 0);
    textSize(16);
    textAlign(LEFT, CENTER);
    system = new ParticleSystem(createVector(width / 2, 50));
    fftSong = new p5.FFT();
    fftSong.setInput(song);
    fftSynth = new p5.FFT();
    fftSynth.setInput(synth);
    fftRhodes = new p5.FFT();
    fftRhodes.setInput(rhodes);
    octaveBands = fftSynth.getOctaveBands(12, 55 / 2); // 12 semitone bands starting from 27.5 Hz (A0)
}

function draw() {
    spectrumSong = fftSong.analyze();
    spectrumSynth = fftSynth.analyze();
    spectrumRhodes = fftRhodes.analyze();
    low = (low * BG_SMOOTHING + fftSong.getEnergy('bass')) / (1 + BG_SMOOTHING);
    mid = (mid * BG_SMOOTHING + fftSong.getEnergy('lowMid', 'mid')) / (1 + BG_SMOOTHING);
    high = (high * BG_SMOOTHING + fftSong.getEnergy('highMid', 'treble')) / (1 + BG_SMOOTHING);
    background(high * 2, mid * 0.3, low * 0.3);

    logAvgsSynth = fftSynth.logAverages(octaveBands);
    logAvgsRhodes = fftRhodes.logAverages(octaveBands);

    // noFill();
    // stroke(130);
    // beginShape();
    // for (let i = 0; i < spectrum.length; i++) {
    //     let xpos = width * Math.log2(1 + (i / spectrum.length));
    //     vertex(xpos * FREQ_SCALE_MELODY, map(spectrum[i], 0, 255, height, 0));
    // }
    // endShape();

    system.addParticle();
    system.run();
    fill(255);
    // text(`Particles: ${system.particles.length}`, 30, 150);
}

// A simple Particle class
let Particle = function (position,
                         size,
                         color,
                         vel = createVector(random(-70, 70), random(-10, 0)),
                         accel = createVector(0, 450 * size / 24)) {
    this.acceleration = accel;
    this.velocity = vel;
    this.position = position.copy();
    this.lifespan = 255;
    this.size = size * 1.5;
    this.color = color;
};

Particle.prototype.run = function () {
    this.update();
    this.display();
};

// Method to update position
Particle.prototype.update = function () {
    this.velocity.add(p5.Vector.mult(this.acceleration, deltaTime * 0.001));
    this.position.add(p5.Vector.mult(this.velocity, deltaTime * 0.001));
    this.lifespan -= 2.5;
};

// Method to display
Particle.prototype.display = function () {
    noStroke();
    let c = this.color;
    fill(color(red(c), green(c), blue(c), alpha(c) * this.lifespan / 255));
    ellipse(this.position.x, this.position.y, this.size, this.size);
};

// Is the particle still useful?
Particle.prototype.isDead = function () {
    return this.lifespan < 0;
};

let ParticleSystem = function (position) {
    this.origin = position.copy();
    this.particles = [];
};

let prevSynthHighestAmp = 0;
let prevRhodesHighestAmp = 0;

ParticleSystem.prototype.addParticle = function () {

    // Display notes from 12 semitone logAvg of FFTs

    // Notes for Synth on left

    let highestAmpSynth = 0;
    let semitoneWithHighestAmpSynth = 0;
    for (let i = 0; i < logAvgsSynth.length; i++) {
        // i represents semitones from note A0 (27.5hz)
        let amp = logAvgsSynth[i];
        if (amp > highestAmpSynth) {
            highestAmpSynth = amp;
            semitoneWithHighestAmpSynth = i;
        }

        // These notes aren't the loudest but they are prominent enough
        // definitely lots of false positives here
        if (amp > prevSynthHighestAmp - BG_TO_MELODY_DIFF_SYNTH &&
            amp > BG_AMP_THRESH_SYNTH &&
            Math.random() < Math.pow(0.8 * (amp - prevSynthHighestAmp + BG_TO_MELODY_DIFF_SYNTH) / BG_TO_MELODY_DIFF_SYNTH, 5)) {
            this.particles.push(new Particle(
                createVector(30, map(i, 0, 60, height, 0, false)),
                10 + amp / 255 * 20,
                semitoneToColor(i, amp * 0.4),
                createVector(30 + amp / 255 * 300, random(-40, 40)),
                createVector(0, -100 - amp / 255 * 150)
            ));
        }
    }
    fill(255);
    // text(`loudest semitone synth: ${semitoneWithHighestAmpSynth} (${semitoneWithHighestAmpSynth % 12}) @ ${highestAmpSynth}`, 30, 30);
    // Create particles for the loudest note
    if (Math.random() < 0.7 && highestAmpSynth > MELODY_AMP_THRESH_SYNTH) {
        this.particles.push(new Particle(
            createVector(30, map(semitoneWithHighestAmpSynth, 0, 60, height, 0, false)),
            20 + highestAmpSynth / 255 * 20,
            semitoneToColor(semitoneWithHighestAmpSynth, highestAmpSynth),
            createVector(50 + highestAmpSynth / 255 * 400, random(-40, 40)),
            createVector(0, -100 - highestAmpSynth / 255 * 150)
        ));
    }

    prevSynthHighestAmp = highestAmpSynth;

    // Notes for rhodes on the right

    let highestAmpRhodes = 0;
    let semitoneWithHighestAmpRhodes = 0;
    for (let i = 0; i < logAvgsRhodes.length; i++) {
        // i represents semitones from note A0 (27.5hz)
        let amp = logAvgsRhodes[i];
        if (amp > highestAmpRhodes) {
            highestAmpRhodes = amp;
            semitoneWithHighestAmpRhodes = i;
        }

        // These notes aren't the loudest but they are prominent enough
        // definitely lots of false positives here
        if (amp > prevRhodesHighestAmp - BG_TO_MELODY_DIFF_RHODES &&
            amp > BG_AMP_THRESH_RHODES &&
            Math.random() < Math.pow(0.8 * (amp - prevRhodesHighestAmp + BG_TO_MELODY_DIFF_RHODES) / BG_TO_MELODY_DIFF_RHODES, 5)) {
            this.particles.push(new Particle(
                createVector(width - 30, map(i, 0, 60, height, 0, false)),
                15 + amp / 255 * 20,
                semitoneToColor(i, amp * 0.4),
                createVector(-(50 + amp / 255 * 350), random(-40, 40)),
                createVector(0, -100 - amp / 255 * 150)
            ));
        }
    }
    fill(255);
    // text(`loudest semitone rhodes: ${semitoneWithHighestAmpRhodes} (${semitoneWithHighestAmpRhodes % 12}) @ ${highestAmpRhodes}`, 30, 70);
    // Create particles for the loudest note
    if (Math.random() < 0.7 && highestAmpRhodes > MELODY_AMP_THRESH_RHODES) {
        this.particles.push(new Particle(
            createVector(width - 30, map(semitoneWithHighestAmpRhodes, 0, 60, height, 0, false)),
            20 + highestAmpRhodes / 255 * 20,
            semitoneToColor(semitoneWithHighestAmpRhodes, highestAmpRhodes),
            createVector(-(50 + highestAmpRhodes / 255 * 400), random(-40, 40)),
            createVector(0, -100 - highestAmpRhodes / 255 * 150)
        ));
    }

    prevRhodesHighestAmp = highestAmpRhodes;

    // Draw noise particles based on brightness and melody note

    let centroid = fftSong.getCentroid();
    let logCentroid = Math.log2(centroid);
    // text(`centroid: ${centroid} hz (${logCentroid})`, 30, 110);

    let useSynth = Math.random() < 0.5;
    let col = semitoneToColor(
        useSynth ? semitoneWithHighestAmpSynth : semitoneWithHighestAmpRhodes,
        (useSynth ? highestAmpSynth : highestAmpRhodes) * 0.4);
    colorMode(HSB, 255);

    for (let i = 0; i < spectrumSong.length; i++) {
        let amp = spectrumSong[i];

        if (amp > WATERFALL_AMP_THRESH && Math.random() < Math.pow(0.7 * amp / 255, 5)) {
            let xpos = width * Math.log2(1 + (i / spectrumSong.length));
            let sat = amp / 255 * 150 + map(logCentroid, 9.9, 11.2, 0, 105, true);
            if (sat > 255) sat = 255;
            let bri = amp / 255 * 30 + map(logCentroid, 9.9, 11.2, 0, 225, true);
            if (bri > 255) bri = 255;
            let newcol = color(hue(col), sat, bri);
            this.particles.push(new Particle(
                createVector(
                    width / 2 + (xpos * FREQ_SCALE / 2) * (useSynth ? -1 : 1),
                    this.origin.y),
                amp * 30 / 255,
                newcol));
        }
    }

    colorMode(RGB, 255);
};

ParticleSystem.prototype.run = function () {
    for (let i = this.particles.length - 1; i >= 0; i--) {
        let p = this.particles[i];
        p.run();
        if (p.isDead()) {
            this.particles.splice(i, 1);
        }
    }
};

function semitoneToColor(semitone, alpha = 255) {
    // assumes 0 is A
    let s = semitone % 12;
    let c;
    switch (s) {
        case 0: // A
            c = color('#FF0000');
            break;
        case 1: // Bb
            c = color('#FF6700');
            break;
        case 2: // B
            c = color('#ffc700');
            break;
        case 3: // C
            c = color('#cbff00');
            break;
        case 4: // C#
            c = color('#83ff00');
            break;
        case 5: // D
            c = color('#00ff2a');
            break;
        case 6: // Eb
            c = color('#00ff9a');
            break;
        case 7: // E
            c = color('#00d5ff');
            break;
        case 8: // F
            c = color('#2c7bff');
            break;
        case 9: // F#
            c = color('#8d66ff');
            break;
        case 10: // G
            c = color('#e948ff');
            break;
        case 11: // G#
            c = color('#ff00a9');
            break;
    }
    c.setAlpha(alpha);
    return c;
}