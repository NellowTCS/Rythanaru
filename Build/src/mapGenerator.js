import { DIFFICULTY_CONFIG } from "./constants";

export class MapGenerator {
    static generate(buffer, difficulty = 'NORMAL') {
        const rawData = buffer.getChannelData(0);
        const sampleRate = buffer.sampleRate;
        const config = DIFFICULTY_CONFIG[difficulty];
        const notes = [];
        let lastNoteTime = 0;

        for (let i = 0; i < rawData.length; i += 1024) {
            const time = i / sampleRate;
            const amplitude = Math.abs(rawData[i]);

            if (amplitude > config.threshold && (time - lastNoteTime) > config.minInterval) {
                const lane = Math.floor(Math.random() * 4);
                const isGold = amplitude > config.goldThreshold;
                const isDouble = amplitude > config.goldThreshold + 0.15;
                const isHold = Math.random() > 0.8 && !isDouble;

                notes.push({
                    id: crypto.randomUUID(),
                    time: time * 1000,
                    lane,
                    type: isHold ? 'hold' : (isGold ? 'gold' : 'normal'),
                    duration: isHold ? Math.random() * 400 + 200 : 0,
                    hit: false, missed: false, holding: false
                });

                if (isDouble && !isHold) {
                    notes.push({
                        id: crypto.randomUUID(),
                        time: time * 1000,
                        lane: (lane + Math.floor(Math.random() * 3) + 1) % 4,
                        type: 'normal',
                        duration: 0,
                        hit: false, missed: false, holding: false
                    });
                }
                lastNoteTime = time;
            } else if (Math.random() < (config.mineChance / 50) && (time - lastNoteTime) > 0.2) {
                notes.push({
                    id: crypto.randomUUID(),
                    time: time * 1000,
                    lane: Math.floor(Math.random() * 4),
                    type: 'mine',
                    duration: 0,
                    hit: false, missed: false, holding: false
                });
            }
        }
        return notes.sort((a,b) => a.time - b.time);
    }
}