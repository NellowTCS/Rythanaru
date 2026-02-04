export class AudioEngine {
    constructor() {
        this.ctx = null;
        this.buffer = null;
        this.source = null;
        this.analyzer = null;
        this.isSetup = false;
    }

    init() {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();
        this.analyzer = this.ctx.createAnalyser();
        this.analyzer.fftSize = 256;
        this.analyzer.smoothingTimeConstant = 0.8;
        this.isSetup = true;
    }

    async loadFile(file) {
        if (!this.isSetup) this.init();
        const arrayBuffer = await file.arrayBuffer();
        this.buffer = await this.ctx.decodeAudioData(arrayBuffer);
        return this.buffer;
    }

    play(onEnded) {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        this.source = this.ctx.createBufferSource();
        this.source.buffer = this.buffer;
        this.source.connect(this.analyzer);
        this.analyzer.connect(this.ctx.destination);
        this.source.onended = onEnded;
        this.source.start(0);
        return this.ctx.currentTime;
    }

    pause() { if (this.ctx) this.ctx.suspend(); }
    resume() { if (this.ctx) this.ctx.resume(); }
    stop() {
        if (this.source) {
            try { this.source.stop(); } catch(e) {}
            this.source.disconnect();
        }
    }

    getAnalysis() {
        if (!this.analyzer) return { bass: 0, mids: 0, highs: 0, freqData: [] };
        const freqData = new Uint8Array(this.analyzer.frequencyBinCount);
        this.analyzer.getByteFrequencyData(freqData);
        return {
            freqData,
            bass: freqData.slice(0, 4).reduce((a,b)=>a+b,0) / 4 / 255,
            mids: freqData.slice(10, 20).reduce((a,b)=>a+b,0) / 10 / 255,
            highs: freqData.slice(40, 60).reduce((a,b)=>a+b,0) / 20 / 255
        };
    }
}