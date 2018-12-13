import { Router } from 'express';
import bodyParser from 'body-parser';
import mongoose from 'mongoose';
import { version } from '../../package.json';
import facets from './facets';


export default ({ config, db }) => {
  const api = Router();
  // console.log('aaaaaaa');
  // console.log(facets);

  // api.use('/facets', facets({ config, db })); --> in index.js

  // mount the facets resource

  // // perhaps expose some API metadata at the root
  api.get('/', (req, res) => {
    res.json({ version });
  });

  // api.route('/')
  // .get((req, res, next) => {
  //   res.statusCode = 200;
  //   res.setHeader('Content-Type', 'application/json');
  //   res.json();
  // });

  // api.use('/facets', facets({ config, db }));
  return api;
};
