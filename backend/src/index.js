import file from './file.js';
import database from './database.js';
import data from './data.js';
import express from 'express';
import path from 'path';

const filePath = "./atualizacao_preco_exemplo.csv";

const db = database.connection;

db.connect();

const app = express();

let rows = [];

app.get('/', (req, res)=>{
  file.readFile(filePath)
  .then(
    result => { 
      rows = data.getProductsInUpdateFile(result);
      data.manageProductInfoBeforeUpdated(rows, db)
        .then(response =>{
          res.json(response);
        })
        .catch(err => console.log(err));
    }, 
    err => console.error(err)
  )
  .catch(err => console.log(err));
})

app.listen(3000);