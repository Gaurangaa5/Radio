const folderBtn = document.getElementById("folderBtn");
const playBtn = document.getElementById("playBtn");
const nextBtn = document.getElementById("nextBtn");
const audio = document.getElementById("audio");
const nowPlaying = document.getElementById("nowPlaying");
const status = document.getElementById("status");
const list = document.getElementById("list");
const songCount = document.getElementById("songCount");
const progress = document.getElementById("progress");
const currentTimeEl = document.getElementById("currentTime");
const durationEl = document.getElementById("duration");

let songs = [];
let currentIndex = -1;
let breakTimer = null;
let currentUrl = null;

folderBtn.addEventListener("click", chooseFolder);
playBtn.addEventListener("click", togglePlayPause);
nextBtn.addEventListener("click", playRandomSong);

async function chooseFolder() {
  if (!window.showDirectoryPicker) {
    alert("Please use a recent Google Chrome or Microsoft Edge.");
    return;
  }

  try {
    const root = await window.showDirectoryPicker({ mode: "read" });
    await loadSongs(root);
  } catch (e) {
    if (e.name !== "AbortError") {
      console.error(e);
      status.textContent = "Could not read that folder.";
    }
  }
}

async function loadSongs(root) {
  clearInterval(breakTimer);
  songs = [];
  currentIndex = -1;

  if (currentUrl) {
    URL.revokeObjectURL(currentUrl);
    currentUrl = null;
  }

  audio.removeAttribute("src");
  audio.load();

  // The user may select the actual songs folder OR its parent.
  let folder = root;

  if (root.name.toLowerCase() !== "songs") {
    try {
      folder = await root.getDirectoryHandle("songs");
    } catch (e) {
      status.textContent = 'No "songs" folder was found.';
      list.innerHTML = '<div class="empty">Select the actual <b>songs</b> folder, or select the folder containing it.</div>';
      songCount.textContent = "0 songs";
      nowPlaying.textContent = "Select your radio folder";
      return;
    }
  }

  await scan(folder);

  songs.sort((a, b) =>
    a.path.localeCompare(b.path, undefined, { numeric: true, sensitivity: "base" })
  );

  renderList();
  songCount.textContent = `${songs.length} song${songs.length === 1 ? "" : "s"}`;

  if (!songs.length) {
    nowPlaying.textContent = "No songs found";
    status.textContent = "Put supported audio files inside the songs folder.";
    return;
  }

  status.textContent = `${songs.length} songs loaded • Starting radio...`;
  setTimeout(playRandomSong, 400);
}

async function scan(folder, path = "") {
  for await (const [name, handle] of folder.entries()) {
    if (
      handle.kind === "file" &&
      /\.(mp3|mpeg|mpga|m4a|aac|wav|ogg|oga|opus|webm|flac)$/i.test(name)
    ) {
      songs.push({
        name,
        handle,
        path: path ? `${path}/${name}` : name
      });
    } else if (handle.kind === "directory") {
      await scan(handle, path ? `${path}/${name}` : name);
    }
  }
}

function renderList() {
  list.innerHTML = "";

  if (!songs.length) {
    list.innerHTML = '<div class="empty">No supported audio songs found.</div>';
    return;
  }

  songs.forEach((song, i) => {
    const b = document.createElement("button");
    b.className = "song" + (i === currentIndex ? " active" : "");

    const n = document.createElement("span");
    n.className = "number";
    n.textContent = String(i + 1).padStart(2, "0");

    const s = document.createElement("span");
    s.className = "song-name";
    s.textContent = song.path;

    b.append(n, s);
    b.addEventListener("click", () => playSong(i));
    list.appendChild(b);
  });
}

async function playSong(i) {
  if (!songs.length) return;

  clearInterval(breakTimer);
  currentIndex = i;

  try {
    const file = await songs[i].handle.getFile();

    if (currentUrl) URL.revokeObjectURL(currentUrl);

    currentUrl = URL.createObjectURL(file);
    audio.src = currentUrl;
    nowPlaying.textContent = songs[i].name;
    status.textContent = "Playing";
    progress.value = 0;
    currentTimeEl.textContent = "0:00";
    durationEl.textContent = "0:00";

    renderList();
    await audio.play();
  } catch (e) {
    console.error(e);
    status.textContent = "Press Play to start.";
  }
}

function playRandomSong() {
  if (!songs.length) return;

  let i = Math.floor(Math.random() * songs.length);

  if (songs.length > 1) {
    while (i === currentIndex) {
      i = Math.floor(Math.random() * songs.length);
    }
  }

  playSong(i);
}

function togglePlayPause() {
  if (!songs.length) return;

  if (currentIndex < 0) {
    playRandomSong();
    return;
  }

  if (audio.paused) {
    audio.play().catch(e => {
      console.error(e);
      status.textContent = "Press Play to start.";
    });
  } else {
    audio.pause();
  }
}

audio.addEventListener("play", () => {
  playBtn.textContent = "Ⅱ";
  playBtn.setAttribute("aria-label", "Pause");
  if (currentIndex >= 0) {
    nowPlaying.textContent = songs[currentIndex].name;
    status.textContent = "Playing";
  }
});

audio.addEventListener("pause", () => {
  playBtn.textContent = "▷";
  playBtn.setAttribute("aria-label", "Play");
  if (!audio.ended && currentIndex >= 0) {
    status.textContent = "Paused";
  }
});

audio.addEventListener("ended", () => {
  if (!songs.length) return;

  nowPlaying.textContent = "Break";
  let seconds = 5;
  status.textContent = `Break • Next song in ${seconds}s`;

  breakTimer = setInterval(() => {
    seconds--;

    if (seconds > 0) {
      status.textContent = `Break • Next song in ${seconds}s`;
    } else {
      clearInterval(breakTimer);
      breakTimer = null;
      playRandomSong();
    }
  }, 1000);
});

audio.addEventListener("timeupdate", () => {
  if (!audio.duration || !isFinite(audio.duration)) return;

  progress.value = (audio.currentTime / audio.duration) * 100;
  currentTimeEl.textContent = formatTime(audio.currentTime);
  durationEl.textContent = formatTime(audio.duration);
});

audio.addEventListener("loadedmetadata", () => {
  durationEl.textContent = formatTime(audio.duration);
});

progress.addEventListener("input", () => {
  if (audio.duration) {
    audio.currentTime = (progress.value / 100) * audio.duration;
  }
});

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return "0:00";

  return (
    Math.floor(seconds / 60) +
    ":" +
    String(Math.floor(seconds % 60)).padStart(2, "0")
  );
}
