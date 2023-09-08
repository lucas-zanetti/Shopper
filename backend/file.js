import fs from 'fs';
import { parse } from 'csv-parse';

export default {
    readFile : function(filePath){
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
}