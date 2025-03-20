const normalizeString = str => str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim();

const normalizeQuantity = str => {
    return str
        .replace(/(\d+[,\.]?\d*)\s?(litros?|l)/gi, '$1l')
        .replace(/(\d+[,\.]?\d*)\s?(quilos?|kg)/gi, '$1kg')
        .replace(/(\d+[,\.]?\d*)\s?(gramas?|g)/gi, '$1g')
        .replace(/1000g/gi, '1kg')
        .replace(/1000ml/gi, '1l')
        .replace(/(\d+),(\d+)/g, '$1.$2');
};

const normalizeType = str => {
    return str
        .replace(/semi[- ]?desnatado/gi, 'semidesnatado')
        .replace(/sem[- ]?lactose/gi, 'semlactose')
        .replace(/zero[- ]?lactose/gi, 'zerolactose');
};

const extractProductInfo = title => {
    const words = title.split(/\s+/);
    const quantityPatterns = Object.freeze(['kg', 'l', 'litro', 'quilo', 'g', 'ml', 'gramas', '1000g', '1000ml']);
    const typePatterns = Object.freeze([
        'integral', 'desnatado', 'semidesnatado', 'semi-desnatado', 'semi', 'branco', 'preto', 'carioca',
        'zero', 'lactose', 'sem', 'fatiado', 'patinho', 'parafuso', 'espaguete',
        'bovina', 'moída', 'mussarela', 'prato', 'soja', 'laranja', 'uva'
    ]);
    const optionalModifiers = Object.freeze(['fresco', 'congelado']);
    const commonNames = Object.freeze([
        'leite', 'arroz', 'feijão', 'feijao', 'macarrão', 'macarrao', 'suco', 'óleo', 'oleo', 'carne',
        'queijo', 'frango', 'picanha', 'peito', 'filé', 'file'
    ]);
    const compositeBrands = Object.freeze(['Tio João', 'Natural One', 'Del Valle', 'Casa Madeira', 'Casa de Madeira']);
    const ignoredWords = Object.freeze(['de', 'do', 'da', 'para', 'tipo', '1']);

    let quantity = '', brand = '', type = [], name = [], modifiers = [];

    // Extrai quantidade
    for (let i = words.length - 1; i >= 0; i--) {
        const normalizedWord = normalizeString(words[i]);
        if (quantityPatterns.includes(normalizedWord)) {
            quantity = words[i];
            if (i > 0 && !isNaN(+words[i - 1].replace(',', '.'))) {
                quantity = `${words[i - 1]} ${quantity}`;
                words.splice(i - 1, 2);
            } else {
                words.splice(i, 1);
            }
            break;
        }
    }

    // Processa palavras restantes
    const remainingWords = words.filter(word => !ignoredWords.includes(normalizeString(word))).filter(Boolean);
    let titleStr = remainingWords.join(' ');

    // Identifica marcas compostas
    brand = compositeBrands.find(b => titleStr.includes(b)) || '';
    if (brand) {
        titleStr = titleStr.replace(brand, '').trim();
        remainingWords.length = 0;
        remainingWords.push(...titleStr.split(/\s+/));
    }

    // Processa palavras
    for (let i = 0; i < remainingWords.length;) {
        const word = remainingWords[i];
        const normalizedWord = normalizeString(word);

        if (typePatterns.includes(normalizedWord)) {
            if (normalizedWord === 'semi' && i + 1 < remainingWords.length &&
                normalizeString(remainingWords[i + 1]) === 'desnatado') {
                type.push('Semi-Desnatado');
                i += 2;
            } else if ((normalizedWord === 'sem' || normalizedWord === 'zero') &&
                i + 1 < remainingWords.length &&
                normalizeString(remainingWords[i + 1]) === 'lactose') {
                type.push(`${word} ${remainingWords[i + 1]}`);
                i += 2;
            } else {
                type.push(word);
                i++;
            }
        } else if (optionalModifiers.includes(normalizedWord)) {
            modifiers.push(word);
            i++;
        } else if (!name.length && commonNames.includes(normalizedWord)) {
            name.push(word);
            i++;
        } else if (!brand && /^[A-Z]/.test(word) && word.length > 2 && !commonNames.includes(normalizedWord)) {
            brand = word;
            i++;
        } else {
            if (name.length) type.push(word);
            else name.push(word);
            i++;
        }
    }

    // Ajusta marca se não encontrada
    if (!brand && name.length > 1) {
        const brandIdx = name.findIndex(w => /^[A-Z]/.test(w) && w.length > 2 && !commonNames.includes(normalizeString(w)));
        if (brandIdx !== -1) [brand] = name.splice(brandIdx, 1);
    }

    return { brand, type: type.join(' '), name: name.join(' '), quantity, modifiers: modifiers.join(' ') };
};

const generateCategoryKey = title => {
    const ignoredWords = Object.freeze(['de', 'do', 'da', 'para', 'tipo', '1']);
    let normalizedTitle = normalizeString(title);
    normalizedTitle = normalizeQuantity(normalizedTitle);
    normalizedTitle = normalizeType(normalizedTitle);
    const words = normalizedTitle.split(/\s+/).filter(word => !ignoredWords.includes(word)).sort();
    return words.join('_');
};

const generateCategoryName = ({ quantity, type, name, brand, modifiers }) => {
    const normalizedQuantity = normalizeQuantity(quantity || '')
        .replace(/(\d+[,\.]?\d*)\s?l/gi, '$1L')
        .replace(/(\d+[,\.]?\d*)\s?kg/gi, '$1kg')
        .replace(/(\d+[,\.]?\d*)\s?g/gi, '$1g');
    const normalizedType = normalizeType(type || '')
        .replace(/semidesnatado/gi, 'Semi-Desnatado')
        .replace(/semlactose/gi, 'Sem Lactose')
        .replace(/zerolactose/gi, 'Zero Lactose');
    return [
        name || '',
        normalizedType,
        modifiers || '',
        brand || '',
        normalizedQuantity
    ].filter(Boolean).join(' ').trim();
};

module.exports = { normalizeString, extractProductInfo, generateCategoryKey, generateCategoryName };