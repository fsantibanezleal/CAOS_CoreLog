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
    citation: 'Hendrycks, D. & Gimpel, K. (2017). A baseline for detecting misclassified and out-of-distribution examples in neural networks. ICLR. arXiv:1610.02136.',
    url: 'https://arxiv.org/abs/1610.02136',
  },
  {
    id: 'lee2018',
    label: 'Lee et al. 2018',
    citation: 'Lee, K., Lee, K., Lee, H. & Shin, J. (2018). A simple unified framework for detecting out-of-distribution samples and adversarial attacks. NeurIPS. arXiv:1807.03888.',
    url: 'https://arxiv.org/abs/1807.03888',
  },
  {
    id: 'sun2022',
    label: 'Sun et al. 2022',
    citation: 'Sun, Y., Ming, Y., Zhu, X. & Li, Y. (2022). Out-of-distribution detection with deep nearest neighbors. ICML, PMLR 162:20827-20840.',
    url: 'https://proceedings.mlr.press/v162/sun22d.html',
  },
  {
    id: 'liu2020',
    label: 'Liu et al. 2020',
    citation: 'Liu, W., Wang, X., Owens, J. & Li, Y. (2020). Energy-based out-of-distribution detection. NeurIPS. arXiv:2010.03759.',
    url: 'https://arxiv.org/abs/2010.03759',
  },
  {
    id: 'sun2016coral',
    label: 'Sun & Saenko 2016',
    citation: 'Sun, B. & Saenko, K. (2016). Deep CORAL: correlation alignment for deep domain adaptation. ECCV Workshops. arXiv:1607.01719.',
    url: 'https://arxiv.org/abs/1607.01719',
  },
  {
    id: 'ganin2016',
    label: 'Ganin et al. 2016',
    citation: 'Ganin, Y. et al. (2016). Domain-adversarial training of neural networks. Journal of Machine Learning Research, 17(59), 1-35. arXiv:1505.07818.',
    url: 'https://arxiv.org/abs/1505.07818',
  },
  {
    id: 'chen2020simclr',
    label: 'Chen et al. 2020',
    citation: 'Chen, T., Kornblith, S., Norouzi, M. & Hinton, G. (2020). A simple framework for contrastive learning of visual representations (SimCLR). ICML. arXiv:2002.05709.',
    url: 'https://arxiv.org/abs/2002.05709',
  },
  {
    id: 'caron2021dino',
    label: 'Caron et al. 2021',
    citation: 'Caron, M. et al. (2021). Emerging properties in self-supervised vision transformers (DINO). ICCV. arXiv:2104.14294.',
    url: 'https://arxiv.org/abs/2104.14294',
  },
  {
    id: 'oquab2023dinov2',
    label: 'Oquab et al. 2023',
    citation: 'Oquab, M. et al. (2023). DINOv2: learning robust visual features without supervision. Transactions on Machine Learning Research. arXiv:2304.07193.',
    url: 'https://arxiv.org/abs/2304.07193',
  },
  {
    id: 'he2022mae',
    label: 'He et al. 2022',
    citation: 'He, K. et al. (2022). Masked autoencoders are scalable vision learners (MAE). CVPR. arXiv:2111.06377.',
    url: 'https://arxiv.org/abs/2111.06377',
  },
  {
    id: 'he2016resnet',
    label: 'He et al. 2016',
    citation: 'He, K., Zhang, X., Ren, S. & Sun, J. (2016). Deep residual learning for image recognition (ResNet). CVPR, 770-778.',
    doi: '10.1109/CVPR.2016.90',
  },
  {
    id: 'howard2019mobilenetv3',
    label: 'Howard et al. 2019',
    citation: 'Howard, A. et al. (2019). Searching for MobileNetV3. ICCV. arXiv:1905.02244.',
    url: 'https://arxiv.org/abs/1905.02244',
  },
  {
    id: 'ronneberger2015unet',
    label: 'Ronneberger et al. 2015',
    citation: 'Ronneberger, O., Fischer, P. & Brox, T. (2015). U-Net: convolutional networks for biomedical image segmentation. MICCAI. arXiv:1505.04597.',
    doi: '10.1007/978-3-319-24574-4_28',
  },
  {
    id: 'kirillov2023sam',
    label: 'Kirillov et al. 2023',
    citation: 'Kirillov, A. et al. (2023). Segment Anything (SAM). ICCV. arXiv:2304.02643.',
    url: 'https://arxiv.org/abs/2304.02643',
  },
  {
    id: 'li2025dcid',
    label: 'Li et al. 2025 (DCID)',
    citation: 'Li, J.-Y., Tang, J.-Z., Zhao, X.-Z., Fan, B., Jiang, W.-Y., Song, S.-Y., Li, J.-B., Chen, K.-D. & Zhao, Z.-G. (2025). A large-scale, high-quality dataset for lithology identification: Construction and applications. Petroleum Science, 22(8), 3207-3228. Data under CC BY-NC 4.0.',
    doi: '10.1016/j.petsci.2025.04.013',
  },
];
