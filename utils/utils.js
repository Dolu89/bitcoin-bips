const FormatBipAsFile = (bipNumber) => {
    var str = new Array(4 - bipNumber.length + 1).join('0')
    return `bip-${str}${bipNumber}`
}

const FormatBipAsTitle = (bipNumber) => {
    return bipNumber
    .toUpperCase()
    .split('-')[1]
    .replace(/0+/, '')
}

export default {
    FormatBipAsFile,
    FormatBipAsTitle
}