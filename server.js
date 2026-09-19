const express = require('express');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process'); // 変更: 記号・スペース入りファイル名に強い execFile を使用

const app = express();
const PORT = 3004;
const BASE_DIR = '/var/samba/share/動画';
const CACHE_DIR = path.join(__dirname, 'cache');

if (!fs.existsSync(CACHE_DIR)) {
	fs.mkdirSync(CACHE_DIR, { recursive: true });
}

app.use(express.static(path.join(__dirname, 'public')));
app.use('/media', express.static(BASE_DIR));

const VIDEO_EXTS = ['.mp4', '.mov', '.m4v', '.webm', '.mkv'];
const isVideo = (filename) => VIDEO_EXTS.includes(path.extname(filename).toLowerCase());

// 追加: 隠しファイル（.で始まるファイル・フォルダ）を除外する判定
const isNotHidden = (filename) => !filename.startsWith('.');

// ディレクトリ一覧の取得
app.get('/api/directories', (req, res) => {
	try {
		const getDirs = (dirPath, relativePath = '') => {
			let results = [];
			const list = fs.readdirSync(dirPath, { withFileTypes: true });
			for (const item of list) {
				// 隠しディレクトリを除外
				if (item.isDirectory() && isNotHidden(item.name)) {
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
			// 隠しファイルを除外 ＆ 動画のみ抽出
			.filter((file) => file.isFile() && isNotHidden(file.name) && isVideo(file.name))
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

	// 変更: ファイル名のエスケープ問題を回避するため execFile を使用
	execFile(
		'ffmpeg',
		[
			'-ss',
			'00:00:01',
			'-i',
			videoPath,
			'-vframes',
			'1',
			'-q:v',
			'2',
			'-s',
			'400x225',
			thumbPath,
			'-y',
		],
		(error, stdout, stderr) => {
			if (error) {
				// エラー原因をターミナルに表示
				console.error(`\n[サムネイル生成エラー] ${videoPath}`);
				console.error(stderr);
				return res.status(500).send('Thumbnail generation failed');
			}
			res.sendFile(thumbPath);
		},
	);
});

app.listen(PORT, '0.0.0.0', () => {
	console.log(`Movie Viewer running at http://0.0.0.0:${PORT}`);
});
