const express = require('express');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const app = express();
const PORT = 3004;
const BASE_DIR = '/var/samba/share/動画';
const CACHE_DIR = path.join(__dirname, 'cache');

if (!fs.existsSync(CACHE_DIR)) {
	fs.mkdirSync(CACHE_DIR, { recursive: true });
}

app.use(express.static(path.join(__dirname, 'public')));
app.use('/media', express.static(BASE_DIR));

// 動画ファイルの拡張子判定
const VIDEO_EXTS = ['.mp4', '.mov', '.m4v', '.webm', '.mkv'];
const isVideo = (filename) => VIDEO_EXTS.includes(path.extname(filename).toLowerCase());

// ディレクトリ一覧の取得（再帰的にサブディレクトリを抽出）
app.get('/api/directories', (req, res) => {
	try {
		const getDirs = (dirPath, relativePath = '') => {
			let results = [];
			const list = fs.readdirSync(dirPath, { withFileTypes: true });
			for (const item of list) {
				if (item.isDirectory()) {
					const rel = relativePath ? `${relativePath}/${item.name}` : item.name;
					results.push(rel);
					results = results.concat(getDirs(path.join(dirPath, item.name), rel));
				}
			}
			return results;
		};
		const dirs = getDirs(BASE_DIR);
		res.json(dirs);
	} catch (err) {
		res.status(500).json({ error: 'ディレクトリの読み込みに失敗しました' });
	}
});

// 指定ディレクトリ内の動画ファイル一覧取得
app.get('/api/videos', (req, res) => {
	const relDir = req.query.dir || '';
	const targetDir = path.join(BASE_DIR, relDir);

	if (!targetDir.startsWith(BASE_DIR)) {
		return res.status(403).json({ error: '不正なアクセスです' });
	}

	try {
		if (!fs.existsSync(targetDir)) {
			return res.json([]);
		}
		const files = fs.readdirSync(targetDir, { withFileTypes: true });
		const videos = files
			.filter((file) => file.isFile() && isVideo(file.name))
			.map((file) => ({
				name: file.name,
				path: path.join(relDir, file.name),
				src: `/media/${path.join(relDir, file.name)}`,
			}));
		res.json(videos);
	} catch (err) {
		res.status(500).json({ error: '動画一覧の取得に失敗しました' });
	}
});

// サムネイル画像のオンデマンド生成＆配信
app.get('/api/thumbnail', (req, res) => {
	const relPath = req.query.path;
	if (!relPath) return res.status(400).send('Path required');

	const videoPath = path.join(BASE_DIR, relPath);
	const hashName = Buffer.from(relPath).toString('hex') + '.jpg';
	const thumbPath = path.join(CACHE_DIR, hashName);

	if (fs.existsSync(thumbPath)) {
		return res.sendFile(thumbPath);
	}

	// FFmpegで再生開始1秒時点のフレームをキャプチャ
	const cmd = `ffmpeg -ss 00:00:01 -i "${videoPath}" -vframes 1 -q:v 2 -s 400x225 "${thumbPath}" -y`;
	exec(cmd, (error) => {
		if (error) {
			return res.status(500).send('Thumbnail generation failed');
		}
		res.sendFile(thumbPath);
	});
});

app.listen(PORT, '0.0.0.0', () => {
	console.log(`Movie Viewer running at http://192.168.100.142:${PORT}`);
});
