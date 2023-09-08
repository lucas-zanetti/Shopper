import file from './file.js';
import database from './database.js';
import data from './data.js';

const filePath = "./atualizacao_preco_exemplo.csv";

const db = database.connection;

db.connect();

let rows = [];

file.readFile(filePath)
  .then(
    result => { 
      rows = data.getProductsInUpdateFile(result);
      data.manageProductInfoBeforeUpdated(rows, db);
    }, 
    err => console.error(err)
  )
  .catch(err => console.log(err));