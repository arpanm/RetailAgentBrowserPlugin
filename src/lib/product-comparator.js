export function compareProducts(products = []) {
    if (!Array.isArray(products) || products.length === 0) return { winner: null, candidates: [] };
    const sorted = [...products].sort((a, b) => {
        const aScore = (a.price ?? Number.MAX_VALUE) - (a.rating ?? 0) * 10;
        const bScore = (b.price ?? Number.MAX_VALUE) - (b.rating ?? 0) * 10;
        return aScore - bScore;
    });
    return { winner: sorted[0], candidates: sorted };
}

export function groupSimilarProducts(products = []) {
    return [{ group: 'all', items: products }];
}

export function formatComparisonResult(result = {}) {
    return result;
}


