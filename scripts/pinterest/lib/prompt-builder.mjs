const CLUSTER_SCENES = {
  kitchen: "a small Japanese apartment kitchen with cabinets and sink",
  oneroom: "a compact one-room studio apartment in Japan",
  closet: "a small closet and wardrobe storage area",
  entry: "a narrow apartment entryway with shoe storage",
  bath: "a small bathroom vanity with under-sink storage",
  rental: "a rental-friendly apartment interior with no wall damage",
  living: "a small living room with TV and cable management",
};

const VARIANT_STYLES = [
  "split-screen before-and-after organization, left cluttered and right tidy",
  "clean organized after photo, minimalist storage boxes and labels",
  "close-up detail of practical storage products on shelves",
  "wide angle showing space-saving layout for one-person living",
  "warm natural daylight, cozy beige and white color palette",
];

export function buildFluxPrompt(pin, config = {}) {
  const scene = CLUSTER_SCENES[pin.cluster] || CLUSTER_SCENES.oneroom;
  const variantIndex = Number(String(pin.id || "").split("-").pop()) - 1 || 0;
  const style = VARIANT_STYLES[variantIndex % VARIANT_STYLES.length];
  const suffix = config.flux?.promptSuffix
    || "realistic lifestyle photography, vertical composition, no people, no faces, no text, no watermark, high detail, Pinterest aesthetic";

  return [
    scene,
    style,
    `theme: ${pin.keyword}`,
    suffix,
  ].join(", ");
}

export function buildFluxNegativePrompt(config = {}) {
  return config.flux?.negativePrompt
    || "text, letters, watermark, logo, blurry, distorted, extra fingers, people faces, anime, cartoon";
}
