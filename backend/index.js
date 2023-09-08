import mysql from 'mysql';

import fs from 'fs';
import { parse } from 'csv-parse';

const PRODUCT_ID_INVALID = "Product_code must be a positive integer";
const PRODUCT_ID_UNKNOW = "There is no product which matches product_code";
const PRODUCT_VALUE_INVALID = "Product new_value must be a positive float";
const NEW_PRICE_BELOW_COST = "Product new_value must be equal or greater its cost";
const NEW_PRICE_BEYOND_RANGE = "Product new_value must be in 10% range of current price";

const conn = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '1234567',
    database: 'shopperdb'
});

const filePath = "./atualizacao_preco_exemplo.csv";

conn.connect(
    err => err ? 
        console.log(err) : 
        console.log('Database connected successfully!')
);

let rows = [];

readFile(filePath)
  .then(
    result => { 
      rows = getProductsInUpdateFile(result);
      manageProductInfoBeforeUpdated(rows);
    }, 
    err => console.error(err)
  )
  .catch(err => console.log(err));

function readFile(filePath){
  return new Promise((resolve, reject) => {
    let updatePriceRows = [];

    fs.createReadStream(filePath)
    .pipe(parse({ delimiter: ",", from_line: 2 }))
    .on("data", row => {
      updatePriceRows.push(row);
    })
    .on("end", () => {
      console.log('File read successfully');
      resolve(updatePriceRows);
    })
    .on("error", err => {
      reject(err.message);
    });
  });
}

function manageProductInfoBeforeUpdated(rows){
  let validatedRows = validateFileRows(rows);
  
  let validRows = getValidRows(validatedRows);

  let productsOnDatabase = [];
  let productsOnPacks = [];

  let productsOnDbPromisse = checkProductsOnDatabase(validRows);
  let packedProductsPromisse = getProductsOnPacks(validRows);

  Promise.all([productsOnDbPromisse, packedProductsPromisse])
    .then(result =>{
      if(result[0].length){
        result[0].forEach(product => productsOnDatabase.push(product));
      }
      else {
        console.log("There are no products matching product ids on database");
      }
      
      productsOnPacks = result[1];

      validatedRows = handleProductsNotOnDatabase(validatedRows, productsOnDatabase);

      let productsManaged = { productsOnDatabase, productsOnPacks, validatedRows }
      
      addPacksToUpdate(productsManaged)
        .then(result =>{
          updatePrices(result);
        })
        .catch(err => console.log(err));
    })
    .catch(err => console.log(err));
}

function updatePrices(productsManaged){
  checkValueConditions(productsManaged);
  console.log(productsManaged.validatedRows);

  let validRows = getValidRows(productsManaged.validatedRows);
  updateValidRowsOnDatabase(validRows)
    .then(result =>{
      console.log(result);
      conn.end();
      process.exit();
    })
    .catch(err => console.log(err));
}

function checkValueConditions(productsManaged){
  let priceDifferences = calculatePackPricesDifference(productsManaged);

  calculateIndividualProductsPriceDifference(productsManaged).forEach(diff => priceDifferences.push(diff));

  let validatedRows = productsManaged.validatedRows;
  let productsOndb = productsManaged.productsOnDatabase;
  priceDifferences.forEach(diff => {
    let diffProdId = diff.product_id;
    let thisCurrentProductOnDb = productsOndb.find(product => product.code == diffProdId);
    let thisRow = validatedRows.find(row => row.product_id == diffProdId.toString());
    
    if(!thisRow){
      let new_price = (thisCurrentProductOnDb.sales_price + diff.priceDifferenceForProduct);
      thisRow = { product_id: diffProdId.toString(), new_price: new_price.toString() };
      validatedRows.push(thisRow);
      thisRow = validatedRows.find(row => row.product_id == diffProdId.toString());
    }

    if(isBelowCost(diff, thisCurrentProductOnDb)){
      if(thisRow.invalidReason){
        thisRow.invalidReason += `, ${NEW_PRICE_BELOW_COST}`;
      }
      else{
        thisRow.invalidReason = NEW_PRICE_BELOW_COST;
      }
    }
    
    if(isOutDiffRange(diff, thisCurrentProductOnDb)){
      if(thisRow.invalidReason){
        thisRow.invalidReason += `, ${NEW_PRICE_BEYOND_RANGE}`;
      }
      else{
        thisRow.invalidReason = NEW_PRICE_BEYOND_RANGE;
      }
    }
  });
}

function isBelowCost(diff, thisCurrentProductOnDb){
  return ((thisCurrentProductOnDb.sales_price + diff.priceDifferenceForProduct) < thisCurrentProductOnDb.cost_price);
}

function isOutDiffRange(diff, thisCurrentProductOnDb){
  let currentPrice = thisCurrentProductOnDb.sales_price;
  let priceDifference = diff.priceDifferenceForProduct
  return (((currentPrice + priceDifference) > 1.1 * currentPrice) || ((currentPrice + priceDifference) < 0.9 * currentPrice))
}

function calculateIndividualProductsPriceDifference(productsManaged){
  let priceDifferences = [];
  let productsOnDatabase = productsManaged.productsOnDatabase;
  let validRows = getValidRows(productsManaged.validatedRows);
  validRows.forEach(row =>{
    let productId = parseInt(row.product_id);
    let oldPrice = productsOnDatabase.find(product => product.code == productId).sales_price;
    let newPrice = parseFloat(row.new_price);
    let priceDifference = calculateNewPriceDifference(oldPrice, newPrice);
    priceDifferences.push({product_id: productId, priceDifferenceForProduct: parseFloat(priceDifference)});
  });

  return priceDifferences;
}

function calculatePackPricesDifference(productsManaged){
  let productsOnPacks = productsManaged.productsOnPacks;
  let productsOnDatabase = productsManaged.productsOnDatabase;
  let validRows = getValidRows(productsManaged.validatedRows);
  let updatedProductCodes = validRows.map(product => product.product_id);
  let packsToUpdate = productsOnPacks.filter(pack => updatedProductCodes.includes(pack.product_id.toString()));
  let distinctPackCodes = getDistinctPackCodes(productsOnPacks);
  
  let packsPricesDifference = [];
  
  packsToUpdate.forEach(pack => {
    let packProductId = pack.product_id;
    let oldIndividualPrice = productsOnDatabase.find(product => product.code == packProductId).sales_price;
    let newIndividualPrice = parseFloat(validRows.find(product => product.product_id == packProductId.toString()).new_price);
    let priceDifferenceForProduct = calculateNewPriceDifference(oldIndividualPrice, newIndividualPrice, pack.qty);
    packsPricesDifference.push({product_id: pack.pack_id, priceDifferenceForProduct: parseFloat(priceDifferenceForProduct)});
  });

  let totalPackDifferences = [];

  distinctPackCodes.forEach(pack => {
    let totalDifferences = packsPricesDifference.filter(priceDifference => priceDifference.product_id == pack);
    totalPackDifferences.push(totalDifferences.reduce((previousValue, currentValue) => {
      return {
        product_id: previousValue.product_id,
        priceDifferenceForProduct: previousValue.priceDifferenceForProduct + currentValue.priceDifferenceForProduct
      }
    }));
  });

  return totalPackDifferences;
}

function calculateNewPriceDifference(oldPrice, newPrice, quantity = 1){
  return ((newPrice - oldPrice)*quantity).toFixed(2);
}

function handleProductsNotOnDatabase(validatedRows, productsOnDatabase){
  let productCodesOndatabase = productsOnDatabase.map(product => product.code);
  
  validatedRows.forEach(row =>{
    let product_id = parseInt(row.product_id);

    if(!productCodesOndatabase.includes(product_id)){
      if(row.invalidReason == null){
        row.invalidReason = PRODUCT_ID_UNKNOW;
      }
      else{
        row.invalidReason += `, ${PRODUCT_ID_UNKNOW}`
      }
    }
  })

  return validatedRows;
}

function addPacksToUpdate(productsManaged){
  return new Promise((resolve, reject) => {
    getPacksOnDb(productsManaged.productsOnPacks)
    .then(result =>{
      if(result.length){
        result.forEach(pack => productsManaged.productsOnDatabase.push(pack));
        resolve(productsManaged);
      }
    })
    .catch(err => console.log(err));
  })
}

function getPacksOnDb(productsOnPacks){
  let distinctPackCodes = getDistinctPackCodes(productsOnPacks);

  let packs = [];

  distinctPackCodes.forEach(code => packs.push({ product_id: code }));

  return new Promise((resolve, reject) => {
    let packCodes = prepareProductCodesForSelectIn(packs);
    
    if(packCodes == ""){
      reject('There are no packs to be updated!');
    }

    const sql =   `SELECT code, cost_price, sales_price
                  FROM products
                  WHERE code 
                  IN (${packCodes})`;

    conn.query(sql, (err, data) => {
      err ? 
      reject(err) :
      resolve(data)
    });
  });
}

function getProductsInUpdateFile(rows){
  let productsList = [];
  
  if(rows.length > 0){
    for(let i = 0; i < rows.length; i++){
      let currentRow = rows[i];

      productsList.push({product_id: currentRow[0], new_price: currentRow[1]});
    }
  }

  return productsList;
}

function updateValidRowsOnDatabase(rows){
  if(!rows){
     return new Promise((resolve, reject) => { reject('There are no products to be updated!') });
  }

  let updatePromises = [];

  rows.forEach(row =>{
    updatePromises.push(new Promise((resolve, reject) => {
      let id = parseInt(row.product_id);
      let newPrice = parseFloat(row.new_price).toFixed(2);

      const sql =   `UPDATE shopperdb.products
                      SET sales_price = ${newPrice}
                      WHERE code = ${id}`;

      conn.query(sql, (err, data) => {
        err ? 
        reject(err) :
        resolve(data)
      });
    }));
  });

  return Promise.all(updatePromises);
}

function getProductsOnPacks(rows){
  return new Promise((resolve, reject) => {
    let productCodes = prepareProductCodesForSelectIn(rows);
    
    if(productCodes == ""){
      reject('There are no products to be updated!');
    }

    const sql =   `SELECT product_id, pack_id, qty 
                  FROM packs
                  WHERE product_id
                  IN(${productCodes})`;
    conn.query(sql, (err, data) => {
      err ? 
      reject(err) :
      resolve(data)
    });
  });
}

function validateFileRows(rowsToValidate){
  let validatedRows = [];

  rowsToValidate.forEach(row =>{
    let invalidRowReason = isNotValidRow(row);

    invalidRowReason ? 
    (
      row.invalidReason = invalidRowReason,
      validatedRows.push(row)
    ) :
    validatedRows.push(row)
  });

  return validatedRows;
}

function isNotValidRow(row){
  let unvalidReason = "";
  let product_id = row.product_id;
  let new_price = row.new_price;

  if(!isPositiveInteger(product_id)){
    unvalidReason = PRODUCT_ID_INVALID;
  }
  
  if(!isPositiveFloat(new_price)){
    unvalidReason ? 
    unvalidReason += `, ${PRODUCT_VALUE_INVALID}` : 
    unvalidReason = PRODUCT_VALUE_INVALID;
  }

  return unvalidReason;
}

function checkProductsOnDatabase(rows){
  return new Promise((resolve, reject) => {
    let productCodes = prepareProductCodesForSelectIn(rows);

    if(productCodes == ""){
      reject('There are no products to be updated!');
    }
  
    const sql =   `SELECT code, cost_price, sales_price
                  FROM products
                  WHERE code 
                  IN (${productCodes})`;

    conn.query(sql, (err, data) => {
      err ? 
      reject(err) :
      resolve(data)
    });
  });
}

function prepareProductCodesForSelectIn(rows){
  let productCodes = "";

  if(rows.length < 1){
    return productCodes;
  }
  else if(rows.length == 1){
    productCodes = rows[0].product_id;
  }
  else{
    for(let i = 0; i < rows.length; i++){
      if(i == rows.length-1){
        productCodes += rows[i].product_id
      }
      else{
        productCodes += `${rows[i].product_id},`
      }
    }
  }

  return productCodes;
}

function getDistinctPackCodes(productsOnPacks){
  return [...new Set(productsOnPacks.map(product => product.pack_id))]
}

function getValidRows(rows){
  return rows.filter(row => row.invalidReason == null);
}

function isPositiveFloat(s) {
  return !isNaN(s) && Number(s) > 0;
}

function isPositiveInteger(s){
  return Number.isInteger(parseInt(s)) && Number.parseInt(s) > 0
}