"""The learned-model contracts. CoreLog's CV core (the tray generator + run-merge segmentation + the classical
baseline) is the TypeScript engine in frontend/src/cv/, it is NOT re-implemented in Python. This package only
declares the patch/feature contracts of the two learned models so the offline trainer (science/train_litho.py) and
the in-browser inference agree byte-for-byte. See model/learned.py."""
