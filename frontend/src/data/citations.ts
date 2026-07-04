import type { Citation } from '@fasl-work/caos-app-shell';

// The references CoreLog's methodology rests on, core-image lithology CV + the classical texture baseline.
export const CITATIONS: Citation[] = [
  {
    id: 'baraboshkin2020',
    label: 'Baraboshkin et al. 2020',
    citation: 'Baraboshkin, E. E. et al. (2020). Deep convolutions for in-depth automated rock typing. Computers & Geosciences, 135, 104330.',
    doi: '10.1016/j.cageo.2019.104330',
  },
  {
    id: 'alzubaidi2021',
    label: 'Alzubaidi et al. 2021',
    citation: 'Alzubaidi, F. et al. (2021). Automated lithology classification from drill core images using convolutional neural networks. Journal of Petroleum Science and Engineering, 197, 107933.',
    doi: '10.1016/j.petrol.2020.107933',
  },
  {
    id: 'lecun2015',
    label: 'LeCun et al. 2015',
    citation: 'LeCun, Y., Bengio, Y. & Hinton, G. (2015). Deep learning. Nature, 521, 436–444.',
    doi: '10.1038/nature14539',
  },
  {
    id: 'haralick1973',
    label: 'Haralick et al. 1973',
    citation: 'Haralick, R. M., Shanmugam, K. & Dinstein, I. (1973). Textural features for image classification. IEEE Trans. Systems, Man, and Cybernetics, 3(6), 610–621.',
    doi: '10.1109/TSMC.1973.4309314',
  },
  {
    id: 'ojala2002',
    label: 'Ojala et al. 2002',
    citation: 'Ojala, T., Pietikäinen, M. & Mäenpää, T. (2002). Multiresolution gray-scale and rotation invariant texture classification with local binary patterns. IEEE Trans. PAMI, 24(7), 971–987.',
    doi: '10.1109/TPAMI.2002.1017623',
  },
  {
    id: 'hendrycks2017',
    label: 'Hendrycks & Gimpel 2017',
    citation: 'Hendrycks, D. & Gimpel, K. (2017). A baseline for detecting misclassified and out-of-distribution examples in neural networks. ICLR.',
  },
];
