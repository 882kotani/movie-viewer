document.addEventListener('DOMContentLoaded', () => {
	const dirSelect = document.getElementById('dirSelect');
	const videoGrid = document.getElementById('videoGrid');
	const emptyState = document.getElementById('emptyState');
	const playerModal = document.getElementById('playerModal');
	const fullPlayer = document.getElementById('fullPlayer');
	const closeBtn = document.getElementById('closeBtn');

	// ディレクトリ一覧の読み込み
	fetch('/api/directories')
		.then((res) => res.json())
		.then((dirs) => {
			dirs.forEach((dir) => {
				const option = document.createElement('option');
				option.value = dir;
				option.textContent = dir;
				dirSelect.appendChild(option);
			});
		});

	// ディレクトリ選択時
	dirSelect.addEventListener('change', (e) => {
		const selectedDir = e.target.value;
		if (!selectedDir) {
			videoGrid.innerHTML = '';
			emptyState.style.display = 'block';
			return;
		}
		loadVideos(selectedDir);
	});

	// 動画一覧取得・描画
	function loadVideos(dir) {
		fetch(`/api/videos?dir=${encodeURIComponent(dir)}`)
			.then((res) => res.json())
			.then((videos) => {
				videoGrid.innerHTML = '';
				if (videos.length === 0) {
					emptyState.textContent = '動画が見つかりませんでした。';
					emptyState.style.display = 'block';
					return;
				}

				emptyState.style.display = 'none';
				videos.forEach((video) => {
					const card = document.createElement('div');
					card.className = 'video-card';

					const thumbPath = `/api/thumbnail?path=${encodeURIComponent(video.path)}`;

					card.innerHTML = `
            <div class="thumbnail-box">
              <img src="${thumbPath}" alt="${video.name}" loading="lazy">
            </div>
            <div class="video-title">${video.name}</div>
          `;

					// タップでモーダル全画面再生
					card.addEventListener('click', () => {
						fullPlayer.src = video.src;
						playerModal.classList.add('active');
						fullPlayer.play();
					});

					videoGrid.appendChild(card);
				});
			});
	}

	// モーダル閉じる
	function closeModal() {
		playerModal.classList.remove('active');
		fullPlayer.pause();
		fullPlayer.src = '';
	}

	closeBtn.addEventListener('click', closeModal);
	playerModal.addEventListener('click', (e) => {
		if (e.target === playerModal) closeModal();
	});
});
