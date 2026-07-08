// Names the 3 shadow levels found ad hoc per-screen as reusable style
// objects. Values are unchanged from their original per-screen definitions
// — only the naming/sharing is new.
export const elevation = {
    low: { shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 }, // was Dashboard cards
    medium: { shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 }, // was Login card
    high: { shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 16, elevation: 6 }, // was QR code box
};
