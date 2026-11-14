/** Measure contrast after composing translucent backgrounds through the DOM. */
export async function contrastRatio(locator, property = 'color') {
  return locator.evaluate((node, colorProperty) => {
    const rgba = (value) => {
      const channels = (value.match(/[\d.]+/g) || []).map(Number)
      return [channels[0] || 0, channels[1] || 0, channels[2] || 0, channels[3] ?? 1]
    }
    const composite = (foreground, background) =>
      foreground.slice(0, 3).map((channel, index) =>
        channel * foreground[3] + background[index] * (1 - foreground[3]),
      )
    const ancestors = []
    for (let element = node; element; element = element.parentElement) {
      ancestors.push(rgba(getComputedStyle(element).backgroundColor))
    }
    const background = ancestors.reverse().reduce(
      (result, layer) => composite(layer, result), [255, 255, 255],
    )
    const foreground = composite(rgba(getComputedStyle(node)[colorProperty]), background)
    const luminance = (channels) => channels.map((value) => value / 255)
      .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
      .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0)
    const light = Math.max(luminance(foreground), luminance(background))
    const dark = Math.min(luminance(foreground), luminance(background))
    return (light + 0.05) / (dark + 0.05)
  }, property)
}
