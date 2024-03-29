const createError = require('http-errors');
const fs = require('fs');
const process = require('node:process');
const path = require('node:path');

const { Op } = require('sequelize');

const Album = require('../models/album');
const Artist = require('../models/artist');
const Song = require('../models/song');
const User = require('../models/user');

const getSongMetadata = async (req, res, next) => {
  const songId = req.params.songId;

  let song;

  try {
    song = await Song.findOne({ where: { id: songId } });
  } catch (error) {
    return next(createError(500, 'Error getting songs metadata'));
  }

  const findFileSize = (filePath) => {
    if (!filePath) return 'NA';
    let fullPath = path.join(process.cwd(), filePath);
    fullPath = fullPath.replace(/ /g, '');
    return fs.statSync(fullPath).size;
  };

  res.json({
    title: song.title,
    duration: song.duration,
    artist: song.artist,
    featuredArtist: song.featuredArtist,
    genre: song.genre,
    album: song.album,
    release: song.release,
    playCount: song.playCount,
    likes: !!song.likedBy ? song.likedBy.length : 0,
    coverArt: song.coverArt,
    songSize: findFileSize(song.filePath),
    songSizeLossy: findFileSize(song.filePathLossy),
  });
};

const stream = async (req, res, next) => {
  console.log(
    '\x1b[33m%s\x1b[0m',
    `Gotta optimize so that there aren't multiple request to the database`
  );
  const range = req.headers.range;
  if (!range) {
    return next(createError(416, 'Requires range header'));
  }
  const songId = req.params.songId;
  const userId = req.params.userId;

  let song;
  let formatPreference;

  // gotta add authentication sometime later
  try {
    let user = await User.findOne({
      where: { id: userId },
    });
    formatPreference = user.preference;
  } catch (error) {
    console.log(error.message);
    return next(createError(404, 'User not found'));
  }

  try {
    song = await Song.findOne({
      attributes: ['filePath', 'filePathLossy'],
      where: { id: songId },
    });
  } catch (error) {
    return next(createError(404, 'Error streaming'));
  }

  if (song === null) {
    return next(createError(404, 'Requested song not found'));
  }

  let songPath, contentTypeHeader;
  if (formatPreference === 'flac') {
    songPath = path.join(process.cwd(), song.filePath);
    contentTypeHeader = 'audio/flac';
  } else {
    songPath = path.join(process.cwd(), song.filePathLossy);
    contentTypeHeader = 'audio/opus';
  }
  songPath = songPath.replace(/ /g, '');
  const songSize = fs.statSync(songPath).size;

  const CHUNK_SIZE = 10 ** 6; // 1MB;
  const start = Number(range.replace(/\D/g, ''));
  const end = Math.min(start + CHUNK_SIZE, songSize - 1);

  const contentLength = end - start + 1;
  const headers = {
    'Content-Range': `bytes ${start}-${end}/${songSize}`,
    'Accept-Ranges': 'bytes',
    'Content-Length': contentLength,
    'Content-Type': contentTypeHeader,
  };

  res.writeHead(206, headers);

  const audioStream = fs.createReadStream(songPath, { start, end });
  audioStream.pipe(res);
};

const search = async (req, res, next) => {
  const { searchQuery } = req.body;

  let songs;

  try {
    songs = await Song.findAll({
      where: {
        title: {
          [Op.iLike]: '%' + searchQuery + '%',
        },
      },
    });
  } catch (error) {
    return next(createError(500, 'Error searching'));
  }

  let searchResult = [];

  for (let i = 0; i < songs.length; i++) {
    let artistName, artistId;
    let albumCover, albumId;

    try {
      let artist = await Artist.findOne({
        where: {
          id: songs[i].artist.trimEnd(),
        },
      });
      artistName = artist.name;
      artistId = artist.id;
    } catch (error) {
      console.log(error.message);
      return next(createError(500, 'Error searching'));
    }

    try {
      let album = await Album.findOne({
        where: {
          id: songs[i].album.trimEnd(),
        },
      });
      albumCover = album.coverArt;
      albumId = album.id;
    } catch (error) {
      console.log(error.message);
      return next(createError(500, 'Error searching'));
    }

    searchResult.push({
      id: songs[i].id,
      title: songs[i].title.trimEnd(),
      artist: artistName.trimEnd(),
      artistId: artistId.trimEnd(),
      coverArt: albumCover.trimEnd(),
      albumId: albumId.trimEnd(),
    });
  }

  res.json(searchResult);
};

const streamAndroid = async (req, res, next) => {
  console.log(
    '\x1b[33m%s\x1b[0m',
    `Gotta optimize so that there aren't multiple request to the database`
  );

  const range = req.headers.range;
  if (!range) {
    return next(createError(416, 'Requires range header'));
  }
  const songId = req.params.songId;
  const userId = req.params.userId;

  let song;
  let formatPreference;

  // gotta add authentication sometime later
  try {
    let user = await User.findOne({
      where: { id: userId },
    });
    formatPreference = user.preference;
  } catch (error) {
    console.log(error.message);
    return next(createError(404, 'User not found'));
  }

  try {
    song = await Song.findOne({
      attributes: ['filePath', 'filePathLossy'],
      where: { id: songId },
    });
  } catch (error) {
    return next(createError(404, 'Error streaming'));
  }

  if (song === null) {
    return next(createError(404, 'Requested song not found'));
  }

  let songPath, contentTypeHeader;
  if (formatPreference === 'flac') {
    songPath = path.join(process.cwd(), song.filePath);
    contentTypeHeader = 'audio/flac';
  } else {
    songPath = path.join(process.cwd(), song.filePathLossy);
    contentTypeHeader = 'audio/opus';
  }
  songPath = songPath.replace(/ /g, '');
  const songSize = fs.statSync(songPath).size;

  const start = Number(range.replace(/\D/g, ''));
  const end = songSize - 1;

  const contentLength = end - start + 1;
  const headers = {
    'Content-Range': `bytes ${start}-${end}`,
    'Accept-Ranges': 'bytes',
    'Content-Length': contentLength,
    'Content-Type': contentTypeHeader,
  };

  res.writeHead(206, headers);
  const audioStream = fs.createReadStream(songPath, { start, end });
  audioStream.pipe(res);
};

exports.getSongMetadata = getSongMetadata;
exports.search = search;
exports.stream = stream;
exports.streamAndroid = streamAndroid;
