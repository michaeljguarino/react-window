import React, { Fragment } from 'react';
import { NavHashLink as Link } from 'react-router-hash-link';
import CodeBlock from '../../components/CodeBlock';
import ComponentApi from '../../components/ComponentApi';

import styles from './shared.module.css';

import CODE from '../../code/VariableSizeListItemSize.js';

export default () => (
  <ComponentApi
    methods={METHODS}
    methodsIntro={
      <p>
        This component has the same methods as{' '}
        <Link to="/api/FixedSizeList#methods">
          <code>FixedSizeList</code>
        </Link>, but with the following additions:
      </p>
    }
    name="VariableSizeList"
    props={PROPS}
    propsIntro={
      <p>
        This component has the same props as{' '}
        <Link to="/api/FixedSizeList#props">
          <code>FixedSizeList</code>
        </Link>, but with the following additions:
      </p>
    }
  />
);

const PROPS = [
  {
    defaultValue: 50,
    description: (
      <Fragment>
        <p>
          Estimated size of a item in the direction being windowed. For vertical
          lists, this is the row height. For horizontal lists, this is the
          column width.
        </p>
        <p>
          This value is used to calculated the estimated total size of a list
          before its items have all been measured. The total size impacts user
          scrolling behavior. It is updated whenever new items are measured.
        </p>
      </Fragment>
    ),
    isRequired: true,
    name: 'estimatedItemSize',
    type: 'number',
  },
  {
    description: (
      <Fragment>
        <p>
          Returns the size of a item in the direction being windowed. For
          vertical lists, this is the row height. For horizontal lists, this is
          the column width.
        </p>
        <div className={styles.CodeBlockWrapper}>
          <CodeBlock value={CODE} />
        </div>
      </Fragment>
    ),
    isRequired: true,
    name: 'itemSize',
    type: '(index: number) => number',
  },
  {
    defaultValue: null,
    description: (
      <Fragment>
        <p>
          In order to save the state of a VariableSizeList (calculated real sizes of the data), pass a
          function via this prop and save its input to later give it within initialMetadata prop.

          For example, if you're caching the data in the list and also saving the scrollOffset obtained
          via onScroll, also save the metadata via providing an onUpdateMetadata function, otherwise
          when giving an initialScrollOffset it would point to an estimated position instead of the exact
          position.

          IMPORTANT: Do not mutate the given metadata. (It's not a copy but the object itself)
        </p>
      </Fragment>
    ),
    isRequired: false,
    name: 'onUpdateMetadata',
    type: '(metadata: { itemMetadataMap: { [index: number]: ItemMetadata }, lastEstimatedIndex: number }) => void'
  },
  {
    defaultValue: {
      itemMetadataMap: {},
      lastEstimatedIndex: -1
    },
    description: (
      <Fragment>
        <p>
          In order to reload saved state of a VariableSizeList, send the saved metadata via this prop.

          For example, if you're caching the data in the list and also saving the scrollOffset obtained
          via onScroll and giving it back via initialScrollOffset when it's remounted, you should also save
          the last calculated metadata obtained from onUpdateMetadata, so that the given scrollOffset would
          result in the same position of the position in saved list.

          That's only necessary because VariableSizeList makes estimations about the size until the content is
          scrolled, and in order to start from the exact same position not the estimated position, the metadata
          of those calculations should also be provided.

          IMPORTANT: Do not mutate the given metadata. (It's not a copy but the object itself)
        </p>
      </Fragment>
    ),
    isRequired: false,
    name: 'initialMetadata',
    type: '{ itemMetadataMap: { [index: number]: ItemMetadata }, lastEstimatedIndex: number }'
  }
];

const METHODS = [
  {
    description: (
      <Fragment>
        <p>
          <code>VariableSizeList</code> caches offsets and measurements for each
          index for performance purposes. This method clears that cached data
          for all items after (and including) the specified index. It should be
          called whenever a item's size changes. (Note that this is not a
          typical occurrance.)
        </p>
        <p>
          By default the list will automatically re-render after the index is
          reset. If you would like to delay this re-render until e.g. a state
          update has completed in the parent component, specify a value of
          <code>false</code>
          for the second, optional parameter.
        </p>
      </Fragment>
    ),
    signature:
      'resetAfterIndex(index: number, shouldForceUpdate: boolean = true): void',
  },
];
