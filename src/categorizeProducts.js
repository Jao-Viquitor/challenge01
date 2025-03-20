const { extractProductInfo, generateCategoryKey, generateCategoryName } = require('./utils');
const products = require('./data/data01.json');

const categorizeProducts = productList => {
    const categoriesMap = new Map();

    for (const product of productList) {
        const productInfo = extractProductInfo(product.title);
        const categoryKey = generateCategoryKey(product.title);

        let category = categoriesMap.get(categoryKey);
        if (!category) {
            category = {
                category: generateCategoryName(productInfo),
                count: 0,
                products: []
            };
            categoriesMap.set(categoryKey, category);
        }

        category.count++;
        category.products.push({
            title: product.title,
            supermarket: product.supermarket
        });
    }

    return [...categoriesMap.values()]
        .sort((a, b) => a.category.localeCompare(b.category));
};

const result = categorizeProducts(products);
console.log(JSON.stringify(result, null, 2));

module.exports = { categorizeProducts };