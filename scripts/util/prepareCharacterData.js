export default function prepareCharacterData(data) {
    if (data.foundryId) {
        data._id = data.foundryId;
        delete data.foundryId;
    }

    if (Array.isArray(data.items)) {
        data.items = data.items.map(item => {
            if (item.foundryId) {
                item._id = item.foundryId;
                delete item.foundryId;
            }
            return item;
        });
    }

    return data;
}
