export default function MyPopup({ open, onClose, children }) {
    if (!open) return null;
    return (
        <div
            style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: "rgba(0,0,0,0.35)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 9999,
            }}
        >
            <div
                style={{
                    background: "#fff",
                    borderRadius: 10,
                    padding: 32,
                    minWidth: 350,
                    boxShadow: "0 2px 16px rgba(0,0,0,0.18)",
                    textAlign: "center",
                }}
            >
                {children}
                <button style={{ marginTop: 20 }} onClick={onClose}>
                    Close
                </button>
            </div>
        </div>
    );
}
