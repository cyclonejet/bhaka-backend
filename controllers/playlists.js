const createError = require('http-errors');
const jwt = require('jsonwebtoken');

const { sequelize } = require('../initDb');

const Playlist = require('../models/playlist');

const validationCheck = require('../hooks/validationCheck');
const { SECRET_KEY } = require('../env');
const User = require('../models/user');

const getPlaylist = async (req, res, next) => {
  const playlistId = req.params.playlistId;

  let playlist;

  try {
    playlist = await Playlist.findOne({ where: { id: playlistId } });
  } catch (error) {
    return next(createError(500, 'Playlist fetch failed'));
  }

  res.json(playlist);
};

const create = async (req, res, next) => {
  validationCheck(req, next);

  const { name, description } = req.body;

  let creator;

  try {
    const token = req.headers.authorization.split(' ')[1];
    if (!token) {
      return next(createError(401, 'Unauthorized'));
    }
    const decodedToken = jwt.verify(token, SECRET_KEY);
    creator = decodedToken.id;
  } catch (error) {
    console.log(error);
    return next(createError(401, 'Unauthorized'));
  }

  const transac = await sequelize.transaction();

  try {
    // create a playlist
    const playlist = await Playlist.create(
      {
        name,
        description,
        creator,
      },
      { transaction: transac }
    );

    // get playlist list of creator
    const user = await User.findOne({
      attributes: ['createdPlaylists'],
      where: {
        id: creator,
      },
    });
    let playlistList = user.createdPlaylists;

    // add newly created playlist to the creator user
    playlistList.push(playlist.id);
    await User.update(
      { createdPlaylists: playlistList },
      {
        where: {
          id: creator,
        },
        transaction: transac,
      }
    );

    await transac.commit();
    res.json({ playlistId: playlist.id });
  } catch (error) {
    console.log(error);
    await transac.rollback();
  }
};

exports.create = create;
exports.getPlaylist = getPlaylist;
