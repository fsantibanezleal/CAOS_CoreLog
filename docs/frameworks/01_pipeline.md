# Framework, the CV pipeline

The CV science. CoreLog goes from a tray image to a depth strip-log in four steps, all browser-runnable.

## 1. Synthetic generation (`tray.ts` + `textures.ts`)

Each lithology has a procedural texture, a base colour + grain + banding/veining, modulated by seeded value noise.
A tray stacks N channels; each channel is a sequence of core runs of different lithologies along x, each covering a
depth slice. The generator returns the RGBA image **and** the ground-truth segments (boundaries + lithology + depth),
so the segmentation can be scored. An image-quality augmentation (shadow gradient / wet darkening) stresses the
classifier.

## 2. The classical baseline (`features.ts`)

Per patch: colour moments (mean R,G,B), luma variance, mean gradient magnitude, and a horizontal/vertical gradient
anisotropy (which captures bedding/foliation), 8 first-order colour/gradient statistics. The classical texture
features of the literature, GLCM ([Haralick 1973](https://doi.org/10.1109/TSMC.1973.4309314)) and LBP
([Ojala 2002](https://doi.org/10.1109/TPAMI.2002.1017623)), are **not implemented** in this build. A nearest-centroid
model (centroids estimated from clean patches of each lithology) classifies the patch. This is what the CNN is
measured against.

## 3. Run-merge segmentation (`segment.ts`)

Slide a P×P window along the channel; classify each patch (baseline or CNN); 3-tap majority smoothing kills
single-position flips; adjacent same-class positions merge into **segments** with a mean confidence. The depth of each
segment is the linear x → depth map within the channel's slice. The segmentation emerges from the patch classifier , 
no separate heavy segmenter.

## 4. Depth stitching → strip-log

Channels read top-to-bottom with increasing depth; segments from all channels are ordered by depth → a vertical
strip-log coloured by lithology, confidence as opacity, out-of-distribution/low-confidence bands hatched.
