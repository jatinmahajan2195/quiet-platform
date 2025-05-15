import React, { useState } from "react";
import { jsPDF } from "jspdf";

/**
 * Product Catalog Builder – polished visual version
 * -------------------------------------------------
 * • Cover page: centered logo (50% width) + company name (36 pt)
 * • Automatic complementary page background picked from logo brightness
 *     - light logo → dark‑teal bg (#004d40)
 *     - dark logo  → light‑grey bg (#f2f2f2)
 * • Product input: Name, Image(s), Price, Description (optional)
 * • Product pages: 4 quadrants with dividing lines; layout →
 *       Name (bold) top‑center
 *       Image square middle
 *       Price bottom‑center (₹ symbol, no stray chars)
 */
export default function App() {
  /* ----------------------------- state ----------------------------- */
  const [logoDataUrl, setLogoDataUrl] = useState(null);
  const [companyName, setCompanyName] = useState("");
  const [bgRGB, setBgRGB] = useState([242, 242, 242]); // default light grey
  const [step, setStep] = useState(1);

  const [inputs, setInputs] = useState([
    { name: "", images: [], price: "", description: "" },
  ]);
  const [products, setProducts] = useState([]); // flattened list
  const [error, setError] = useState("");

  /* ------------------------- helpers ------------------------------ */
  const fileToDataUrl = (file) =>
    new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = (e) => res(e.target.result);
      r.onerror = rej;
      r.readAsDataURL(file);
    });

  const computeBgFromLogo = (dataUrl) => {
    const img = new Image();
    img.src = dataUrl;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const size = 40;
      canvas.width = size;
      canvas.height = size;
      ctx.drawImage(img, 0, 0, size, size);
      const { data } = ctx.getImageData(0, 0, size, size);
      let r = 0,
        g = 0,
        b = 0;
      for (let i = 0; i < data.length; i += 4) {
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
      }
      const pixels = data.length / 4;
      r = Math.round(r / pixels);
      g = Math.round(g / pixels);
      b = Math.round(b / pixels);
      const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
      // choose bg: bright logo → dark teal, dark logo → light grey
      if (brightness > 180) setBgRGB([0, 77, 64]); // #004d40
      else setBgRGB([242, 242, 242]); // #f2f2f2
    };
  };

  /* ----------------------- event handlers ------------------------- */
  const handleLogoChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const url = await fileToDataUrl(file);
    setLogoDataUrl(url);
    computeBgFromLogo(url);
  };

  const changeInput = (idx, field, value) =>
    setInputs((arr) =>
      arr.map((it, i) => (i === idx ? { ...it, [field]: value } : it))
    );

  const changeFiles = (idx, files) =>
    setInputs((arr) =>
      arr.map((it, i) =>
        i === idx ? { ...it, images: Array.from(files) } : it
      )
    );

  const addBlock = () =>
    setInputs((arr) => [
      ...arr,
      { name: "", images: [], price: "", description: "" },
    ]);

  const submitProducts = async (e) => {
    e.preventDefault();
    setError("");
    const flat = [];
    try {
      for (const p of inputs) {
        if (!p.name.trim() || !p.price.trim() || p.images.length === 0) {
          setError("Each product needs a name, price and at least one image.");
          return;
        }
        for (const img of p.images) {
          const url = await fileToDataUrl(img);
          flat.push({ ...p, img: url });
        }
      }
      setProducts(flat);
      setInputs([{ name: "", images: [], price: "", description: "" }]);
    } catch (err) {
      console.error(err);
      setError("Couldn't read an image – please try different files.");
    }
  };

  const generatePdf = () => {
    if (!logoDataUrl || !companyName.trim()) {
      setError("Company logo and name are required.");
      return;
    }
    if (products.length === 0) {
      setError("Add some products first.");
      return;
    }

    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();
    const [bgR, bgG, bgB] = bgRGB;

    /* ---------- cover page ---------- */
    doc.setFillColor(bgR, bgG, bgB);
    doc.rect(0, 0, w, h, "F");

    const logoMax = w * 0.5;
    const logoX = (w - logoMax) / 2;
    const logoY = (h - logoMax) / 2 - 60;
    doc.addImage(logoDataUrl, "PNG", logoX, logoY, logoMax, logoMax);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(36);
    doc.setTextColor(20, 20, 20);
    doc.text(companyName, w / 2, logoY + logoMax + 60, { align: "center" });

    /* ---------- product pages ---------- */
    const cols = 2,
      rows = 2,
      margin = 40,
      cellW = (w - margin * 2) / cols,
      cellH = (h - margin * 2) / rows;

    const drawBackground = () => {
      doc.setFillColor(bgR, bgG, bgB);
      doc.rect(0, 0, w, h, "F");
      // quadrant lines
      doc.setDrawColor(200);
      doc.setLineWidth(0.5);
      doc.line(w / 2, margin, w / 2, h - margin);
      doc.line(margin, h / 2, w - margin, h / 2);
    };

    products.forEach((p, idx) => {
      if (idx % (cols * rows) === 0) {
        doc.addPage();
        drawBackground();
      }
      const pos = idx % (cols * rows);
      const r = Math.floor(pos / cols);
      const c = pos % cols;
      const x = margin + c * cellW;
      const y = margin + r * cellH;
      const imgSize = cellW * 0.55;

      // name
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text(p.name, x + cellW / 2, y + 14, { align: "center" });

      // image centered
      doc.addImage(
        p.img,
        "JPEG",
        x + (cellW - imgSize) / 2,
        y + 24,
        imgSize,
        imgSize
      );

      // price bottom
      doc.setFont("helvetica", "normal");
      doc.setFontSize(12);
      doc.text(`Price: ₹${p.price}`, x + cellW / 2, y + imgSize + 50, {
        align: "center",
      });

      // optional description smaller below price
      if (p.description.trim()) {
        doc.setFontSize(10);
        const descLines = doc.splitTextToSize(p.description, cellW - 20);
        doc.text(descLines, x + cellW / 2, y + imgSize + 70, {
          align: "center",
        });
      }
    });

    doc.save("product-catalog.pdf");
  };

  /* --------------------------- render UI ------------------------- */
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <h1 className="text-3xl font-bold mb-6 text-center">
        Product Catalog Builder
      </h1>

      {step === 1 && (
        <div className="max-w-xl mx-auto bg-white shadow rounded-2xl p-6 flex flex-col gap-4">
          <label className="font-medium">Company Logo:</label>
          <input type="file" accept="image/*" onChange={handleLogoChange} />
          {logoDataUrl && (
            <img
              src={logoDataUrl}
              alt="Logo preview"
              className="max-h-48 object-contain mx-auto"
            />
          )}
          <label className="font-medium mt-4">Company Name:</label>
          <input
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className="border rounded p-2"
            placeholder="Your company name"
          />
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button
            disabled={!logoDataUrl || !companyName.trim()}
            onClick={() => setStep(2)}
            className="bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2 px-4 rounded-2xl mt-4"
          >
            Next: Add Products
          </button>
        </div>
      )}

      {step === 2 && (
        <>
          <form
            onSubmit={submitProducts}
            className="max-w-3xl mx-auto bg-white shadow rounded-2xl p-6 flex flex-col gap-4"
          >
            {inputs.map((inp, idx) => (
              <div key={idx} className="border rounded-xl p-4 bg-gray-50">
                <label className="font-medium">Product Name:</label>
                <input
                  type="text"
                  value={inp.name}
                  onChange={(e) => changeInput(idx, "name", e.target.value)}
                  className="w-full border rounded p-2 mb-3"
                  placeholder="Product name"
                />

                <label className="font-medium">Product Images:</label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => changeFiles(idx, e.target.files)}
                  className="mb-3"
                />

                <label className="font-medium">Price (₹):</label>
                <input
                  type="text"
                  value={inp.price}
                  onChange={(e) => changeInput(idx, "price", e.target.value)}
                  className="w-full border rounded p-2 mb-3"
                  placeholder="e.g., 599"
                />

                <label className="font-medium">Description (optional):</label>
                <textarea
                  rows="2"
                  value={inp.description}
                  onChange={(e) =>
                    changeInput(idx, "description", e.target.value)
                  }
                  className="w-full border rounded p-2"
                  placeholder="Short description"
                />
              </div>
            ))}
            {error && <p className="text-red-600 text-sm -mt-2">{error}</p>}
            <div className="flex gap-4">
              <button
                type="button"
                onClick={addBlock}
                className="bg-gray-200 py-2 px-4 rounded hover:bg-gray-300"
              >
                + Add Another Product
              </button>
              <button
                type="submit"
                className="bg-blue-600 text-white py-2 px-4 rounded-2xl"
              >
                Add Products
              </button>
            </div>
          </form>

          {products.length > 0 && (
            <div className="text-center mt-10">
              <button
                onClick={generatePdf}
                className="bg-green-600 text-white py-3 px-6 rounded-2xl text-lg"
              >
                Download Catalog PDF
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
