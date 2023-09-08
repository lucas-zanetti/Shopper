export default {
    isPositiveFloat: (s) => {
        return !isNaN(s) && Number(s) > 0;
    },
      
    isPositiveInteger: (s) => {
        return Number.isInteger(parseInt(s)) && Number.parseInt(s) > 0
    }
}