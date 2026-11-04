import { ref, watch } from "vue";

// Autoplay policy may reject play(); audio cues are best effort.
const playSafely = (audio) => {
    const result = audio.play();
    if (result && typeof result.catch === "function") {
        result.catch(() => {});
    }
};

export const useAudio = ({
    settings,
    isWork,
    running,
    notify = () => {},
    Audio = globalThis.Audio
}) => {
    // Keyed by what the cue announces, not by the round that just ended.
    const sound = {
        breakStart: new Audio("/audio/audio_break.mp3"),
        workStart: new Audio("/audio/audio_work.mp3"),
        finish: new Audio("/audio/audio_finish.mp3")
    };
    // Music tracks are 25-28 MB. WebKit fetches as soon as src is set,
    // whatever preload says, so the URL is only assigned on first play.
    const lazyAudio = (src) => {
        const track = new Audio();
        track.preload = "none";
        track.dataset.src = src;
        return track;
    };
    const music = {
        nature: lazyAudio("/audio/audio_nature.mp3"),
        rain: lazyAudio("/audio/audio_rain.mp3"),
        cafe: lazyAudio("/audio/audio_cafe.mp3"),
        music: lazyAudio("/audio/audio_music.mp3")
    };
    const musicPlaying = ref(false);

    const shouldPlayMusic = () =>
        isWork()
            ? ["work", "both"].includes(settings.musicTiming.value)
            : ["breaks", "both"].includes(settings.musicTiming.value);

    const soundEffect = (fx, notifyUser = true) => {
        Object.values(sound).forEach((cue) => {
            cue.pause();
            cue.currentTime = 0;
        });
        sound[fx].volume = settings.soundVolume.value / 100;
        playSafely(sound[fx]);
        if (notifyUser) {
            notify(fx);
        }
    };

    const changeVolume = () => {
        Object.values(music).forEach((track) => {
            track.volume = settings.musicVolume.value / 100;
        });
    };

    const musicOn = (fx) => {
        musicPlaying.value = false;
        Object.values(music).forEach((track) => {
            track.pause();
            track.currentTime = 0;
        });
        if (fx === "") {
            return;
        }
        settings.musicPref.value = fx;
        if (running() && !shouldPlayMusic()) {
            return;
        }
        musicPlaying.value = true;
        const track = music[fx];
        if (!track.src) {
            track.src = track.dataset.src;
        }
        track.muted = false;
        playSafely(track);
        if (fx === "nature") {
            track.volume = 0;
            let i = 0;
            const volumeLoop = () => {
                setTimeout(() => {
                    i++;
                    track.volume = i / 100;
                    if (i < settings.musicVolume.value) {
                        volumeLoop();
                    }
                }, 30);
            };
            volumeLoop();
        }
    };

    // The controls' disabled state is bound to isMusic in the template.
    const musicState = () => {
        if (!settings.isMusic.value) {
            musicOn("");
        } else if (running() && shouldPlayMusic()) {
            musicOn(settings.musicPref.value);
        }
    };

    const handleMusicForBreak = () => {
        if (settings.musicTiming.value === "work") {
            if (musicPlaying.value) {
                musicOn("");
            }
        } else if (settings.isMusic.value && !musicPlaying.value) {
            musicOn(settings.musicPref.value);
        }
    };

    const handleMusicForWork = () => {
        if (settings.musicTiming.value === "breaks") {
            if (musicPlaying.value) {
                musicOn("");
            }
        } else if (
            settings.isMusic.value &&
            !musicPlaying.value &&
            shouldPlayMusic()
        ) {
            musicOn(settings.musicPref.value);
        }
    };

    watch(settings.musicTiming, () => {
        if (!settings.isMusic.value) {
            return;
        }
        if (running()) {
            if (shouldPlayMusic() && !musicPlaying.value) {
                musicOn(settings.musicPref.value);
            } else if (!shouldPlayMusic() && musicPlaying.value) {
                musicOn("");
            }
        } else if (
            settings.musicTiming.value === "breaks" &&
            musicPlaying.value
        ) {
            musicOn("");
        }
    });

    return {
        musicPlaying,
        shouldPlayMusic,
        soundEffect,
        changeVolume,
        musicOn,
        musicState,
        handleMusicForBreak,
        handleMusicForWork
    };
};
