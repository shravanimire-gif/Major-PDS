// Collapses the 12 ad hoc font sizes into a named scale, and the 4 ad hoc
// weights (unstated/400, 600, 700, 800) into 3 named weights.
//
// Usage rules:
//   - titles / headings (screen titles, beneficiary name, large numeric
//     displays like grain values and the QR timer) -> weight.bold
//   - labels / badges / card titles / button text -> weight.semibold
//   - body copy, subtitles, hints, captions -> weight.regular
export const typography = {
    size: {
        xs: 12, // card number, grain unit, tx date/qty (was 12/13)
        sm: 14, // subtitles, hints, badge text, greeting, grain label (was 13/14)
        base: 16, // inputs, button labels, body text (was 15/16)
        md: 18, // QR header title, QR CTA text (was 17/18)
        lg: 22, // login title, beneficiary name
        xl: 28, // grain value
        xxl: 32, // QR timer value
        display: 40, // reserved for large brand marks
    },
    weight: {
        regular: "400",
        semibold: "600",
        bold: "700", // also absorbs the former 800 used for grain values
    },
};
