// @flow

import memoizeOne from 'memoize-one';
import { createElement, PureComponent } from 'react';

export type ScrollToAlign = 'auto' | 'center' | 'start' | 'end';

type itemSize = number | ((index: number) => number);
type Direction = 'horizontal' | 'vertical';
type ItemKeyGetter = (index: number) => any;

type RenderComponentProps<T> = {|
  data: T,
  index: number,
  isScrolling?: boolean,
  style: Object,
|};
type RenderComponent<T> = React$ComponentType<$Shape<RenderComponentProps<T>>>;

type ScrollDirection = 'forward' | 'backward';

type onItemsRenderedCallback = ({
  overscanStartIndex: number,
  overscanStopIndex: number,
  visibleStartIndex: number,
  visibleStopIndex: number,
}) => void;
type onScrollCallback = ({
  scrollDirection: ScrollDirection,
  scrollOffset: number,
  scrollUpdateWasRequested: boolean,
}) => void;

type ScrollEvent = SyntheticEvent<HTMLDivElement>;
type ItemStyleCache = { [index: number]: Object };

export type Props<T> = {|
  children: RenderComponent<T>,
  className?: string,
  direction: Direction,
  reversed: boolean,
  height: number | string,
  initialScrollOffset?: number,
  innerRef?: any,
  innerTagName?: string,
  itemCount: number,
  itemData: T,
  itemKey?: ItemKeyGetter,
  itemSize: itemSize,
  onItemsRendered?: onItemsRenderedCallback,
  onScroll?: onScrollCallback,
  outerRef?: any,
  outerTagName?: string,
  overscanCount: number,
  style?: Object,
  useIsScrolling: boolean,
  width: number | string,
|};

type State = {|
  isScrolling: boolean,
  scrollDirection: ScrollDirection,
  scrollOffset: number,
  scrollUpdateWasRequested: boolean,
|};

type GetItemOffset = (
  props: Props<any>,
  index: number,
  instanceProps: any
) => number;
type GetItemSize = (
  props: Props<any>,
  index: number,
  instanceProps: any
) => number;
type GetEstimatedTotalSize = (props: Props<any>, instanceProps: any) => number;
type GetOffsetForIndexAndAlignment = (
  props: Props<any>,
  index: number,
  align: ScrollToAlign,
  scrollOffset: number,
  instanceProps: any
) => number;
type GetStartIndexForOffset = (
  props: Props<any>,
  offset: number,
  instanceProps: any
) => number;
type GetStopIndexForStartIndex = (
  props: Props<any>,
  startIndex: number,
  scrollOffset: number,
  instanceProps: any
) => number;
type InitInstanceProps = (props: Props<any>, instance: any) => any;
type ValidateProps = (props: Props<any>) => void;

const IS_SCROLLING_DEBOUNCE_INTERVAL = 150;

const REVERSE_HORIZONTAL_MATRIX = 'matrix(-1, 0, 0, 1, 0, 0)';
const REVERSE_VERTICAL_MATRIX = 'matrix(1, 0, 0, -1, 0, 0)';

const defaultItemKey: ItemKeyGetter = index => index;

export default function createListComponent({
  getItemOffset,
  getEstimatedTotalSize,
  getItemSize,
  getOffsetForIndexAndAlignment,
  getStartIndexForOffset,
  getStopIndexForStartIndex,
  initInstanceProps,
  shouldResetStyleCacheOnItemSizeChange,
  validateProps,
}: {|
  getItemOffset: GetItemOffset,
  getEstimatedTotalSize: GetEstimatedTotalSize,
  getItemSize: GetItemSize,
  getOffsetForIndexAndAlignment: GetOffsetForIndexAndAlignment,
  getStartIndexForOffset: GetStartIndexForOffset,
  getStopIndexForStartIndex: GetStopIndexForStartIndex,
  initInstanceProps: InitInstanceProps,
  shouldResetStyleCacheOnItemSizeChange: boolean,
  validateProps: ValidateProps,
|}) {
  return class List<T> extends PureComponent<Props<T>, State> {
    _instanceProps: any = initInstanceProps(this.props, this);
    _outerRef: ?HTMLDivElement;
    _resetIsScrollingTimeoutId: TimeoutID | null = null;

    static defaultProps = {
      direction: 'vertical',
      reversed: false,
      innerTagName: 'div',
      itemData: undefined,
      outerTagName: 'div',
      overscanCount: 2,
      useIsScrolling: false,
    };

    state: State = {
      isScrolling: false,
      scrollDirection: 'forward',
      scrollOffset:
        typeof this.props.initialScrollOffset === 'number'
          ? this.props.initialScrollOffset
          : 0,
      scrollUpdateWasRequested: false,
    };

    _getScrollLength(elem: HTMLDivElement) {
      const {
        scrollHeight,
        scrollWidth,
        clientHeight,
        clientWidth,
        scrollTop,
        scrollLeft,
      } = elem;
      return {
        scrollHeight,
        scrollWidth,
        clientHeight,
        clientWidth,
        scrollTop,
        scrollLeft,
        scrollBottom: scrollHeight - clientHeight - scrollTop,
        scrollRight: scrollWidth - clientWidth - scrollLeft,
      };
    }

    _setScrollLeft(elem: HTMLDivElement, scrollLeft: number) {
      const { scrollWidth, clientWidth } = elem;
      elem.scrollLeft = Math.min(
        scrollWidth - clientWidth,
        Math.max(0, scrollLeft)
      );
    }

    _setScrollRight(elem: HTMLDivElement, scrollRight: number) {
      const { scrollWidth, clientWidth } = elem;
      this._setScrollLeft(
        elem,
        scrollWidth - clientWidth - Math.max(0, scrollRight)
      );
    }

    _setScrollTop(elem: HTMLDivElement, scrollTop: number) {
      const { scrollHeight, clientHeight } = elem;
      elem.scrollTop = Math.min(
        scrollHeight - clientHeight,
        Math.max(0, scrollTop)
      );
    }

    _setScrollBottom(elem: HTMLDivElement, scrollBottom: number) {
      const { scrollHeight, clientHeight } = elem;
      this._setScrollTop(
        elem,
        scrollHeight - clientHeight - Math.max(0, scrollBottom)
      );
    }

    _maybeSetScrollOffset(scrollOffset: number) {
      if (this._outerRef !== null) {
        const elem = ((this._outerRef: any): HTMLDivElement);
        const { direction, reversed } = this.props;
        if (direction === 'horizontal') {
          if (reversed) {
            this._setScrollRight(elem, scrollOffset);
          } else {
            this._setScrollLeft(elem, scrollOffset);
          }
        } else {
          if (reversed) {
            this._setScrollBottom(elem, scrollOffset);
          } else {
            this._setScrollTop(elem, scrollOffset);
          }
        }
      }
    }

    // Always use explicit constructor for React components.
    // It produces less code after transpilation. (#26)
    // eslint-disable-next-line no-useless-constructor
    constructor(props: Props<T>) {
      super(props);
    }

    static getDerivedStateFromProps(
      props: Props<T>,
      state: State
    ): $Shape<State> {
      validateSharedProps(props);
      validateProps(props);
      return null;
    }

    scrollTo(scrollOffset: number): void {
      this.setState(
        prevState => ({
          scrollDirection:
            prevState.scrollOffset < scrollOffset ? 'forward' : 'backward',
          scrollOffset: scrollOffset,
          scrollUpdateWasRequested: true,
        }),
        this._resetIsScrollingDebounced
      );
    }

    scrollToItem(index: number, align: ScrollToAlign = 'auto'): void {
      const { scrollOffset } = this.state;
      this.scrollTo(
        getOffsetForIndexAndAlignment(
          this.props,
          index,
          align,
          scrollOffset,
          this._instanceProps
        )
      );
    }

    componentDidMount() {
      const { initialScrollOffset } = this.props;

      if (typeof initialScrollOffset === 'number') {
        this._maybeSetScrollOffset(initialScrollOffset);
      }

      this._callPropsCallbacks();
    }

    componentDidUpdate() {
      const { scrollOffset, scrollUpdateWasRequested } = this.state;

      /*if (scrollUpdateWasRequested && this._outerRef !== null) {
        if (direction === 'horizontal') {
          ((this._outerRef: any): HTMLDivElement).scrollLeft = scrollOffset;
        } else {
          ((this._outerRef: any): HTMLDivElement).scrollTop = scrollOffset;
        }
      }*/

      // if (scrollUpdateWasRequested) {
      this._maybeSetScrollOffset(scrollOffset);
      // }

      this._callPropsCallbacks();
    }

    componentWillUnmount() {
      if (this._resetIsScrollingTimeoutId !== null) {
        clearTimeout(this._resetIsScrollingTimeoutId);
      }
    }

    render() {
      const {
        children,
        className,
        direction,
        reversed,
        height,
        innerRef,
        innerTagName,
        itemCount,
        itemData,
        itemKey = defaultItemKey,
        outerTagName,
        style,
        useIsScrolling,
        width,
      } = this.props;
      const { isScrolling } = this.state;

      const onScroll =
        direction === 'vertical'
          ? this._onScrollVertical
          : this._onScrollHorizontal;

      const [startIndex, stopIndex] = this._getRangeToRender();

      const items = [];
      if (itemCount > 0) {
        for (let index = startIndex; index <= stopIndex; index++) {
          items.push(
            createElement(children, {
              data: itemData,
              key: itemKey(index),
              index,
              isScrolling: useIsScrolling ? isScrolling : undefined,
              style: this._getItemStyle(index),
            })
          );
        }
      }

      // Read this value AFTER items have been created,
      // So their actual sizes (if variable) are taken into consideration.
      const estimatedTotalSize = getEstimatedTotalSize(
        this.props,
        this._instanceProps
      );

      return createElement(
        ((outerTagName: any): string),
        {
          className,
          onScroll,
          ref: this._outerRefSetter,
          style: {
            position: 'relative',
            height,
            width,
            overflow: 'auto',
            WebkitOverflowScrolling: 'touch',
            willChange: 'transform',
            ...style,
          },
        },
        createElement(((innerTagName: any): string), {
          children: items,
          ref: innerRef,
          style: {
            height: direction === 'horizontal' ? '100%' : estimatedTotalSize,
            pointerEvents: isScrolling ? 'none' : '',
            width: direction === 'horizontal' ? estimatedTotalSize : '100%',
            transform: reversed
              ? direction === 'horizontal'
                ? REVERSE_HORIZONTAL_MATRIX
                : REVERSE_VERTICAL_MATRIX
              : '',
          },
        })
      );
    }

    _callOnItemsRendered: (
      overscanStartIndex: number,
      overscanStopIndex: number,
      visibleStartIndex: number,
      visibleStopIndex: number
    ) => void;
    _callOnItemsRendered = memoizeOne(
      (
        overscanStartIndex: number,
        overscanStopIndex: number,
        visibleStartIndex: number,
        visibleStopIndex: number
      ) =>
        ((this.props.onItemsRendered: any): onItemsRenderedCallback)({
          overscanStartIndex,
          overscanStopIndex,
          visibleStartIndex,
          visibleStopIndex,
        })
    );

    _callOnScroll: (
      scrollDirection: ScrollDirection,
      scrollOffset: number,
      scrollUpdateWasRequested: boolean
    ) => void;
    _callOnScroll = memoizeOne(
      (
        scrollDirection: ScrollDirection,
        scrollOffset: number,
        scrollUpdateWasRequested: boolean
      ) =>
        ((this.props.onScroll: any): onScrollCallback)({
          scrollDirection,
          scrollOffset,
          scrollUpdateWasRequested,
        })
    );

    _callPropsCallbacks() {
      if (typeof this.props.onItemsRendered === 'function') {
        const { itemCount } = this.props;
        if (itemCount > 0) {
          const [
            overscanStartIndex,
            overscanStopIndex,
            visibleStartIndex,
            visibleStopIndex,
          ] = this._getRangeToRender();
          this._callOnItemsRendered(
            overscanStartIndex,
            overscanStopIndex,
            visibleStartIndex,
            visibleStopIndex
          );
        }
      }

      if (typeof this.props.onScroll === 'function') {
        const {
          scrollDirection,
          scrollOffset,
          scrollUpdateWasRequested,
        } = this.state;
        this._callOnScroll(
          scrollDirection,
          scrollOffset,
          scrollUpdateWasRequested
        );
      }
    }

    // Lazily create and cache item styles while scrolling,
    // So that pure component sCU will prevent re-renders.
    // We maintain this cache, and pass a style prop rather than index,
    // So that List can clear cached styles and force item re-render if necessary.
    _getItemStyle: (index: number) => Object;
    _getItemStyle = (index: number): Object => {
      const { direction, itemSize, reversed } = this.props;

      const itemStyleCache = this._getItemStyleCache(
        shouldResetStyleCacheOnItemSizeChange && itemSize
      );

      let style;
      if (itemStyleCache.hasOwnProperty(index)) {
        style = itemStyleCache[index];
      } else {
        style = {
          position: 'absolute',
          left:
            direction === 'horizontal'
              ? getItemOffset(this.props, index, this._instanceProps)
              : 0,
          top:
            direction === 'vertical'
              ? getItemOffset(this.props, index, this._instanceProps)
              : 0,
          height:
            direction === 'vertical'
              ? getItemSize(this.props, index, this._instanceProps)
              : '100%',
          width:
            direction === 'horizontal'
              ? getItemSize(this.props, index, this._instanceProps)
              : '100%',
          transform: '',
        };
        if (reversed) {
          style.transform =
            direction === 'horizontal'
              ? REVERSE_HORIZONTAL_MATRIX // horizontally reverse
              : REVERSE_VERTICAL_MATRIX; // vertically reverse
        }
        itemStyleCache[index] = style;
      }

      return style;
    };

    _getItemStyleCache: (_: any) => ItemStyleCache;
    _getItemStyleCache = memoizeOne((_: any) => ({}));

    _getRangeToRender(): [number, number, number, number] {
      const { itemCount, overscanCount } = this.props;
      const { scrollDirection, scrollOffset } = this.state;

      if (itemCount === 0) {
        return [0, 0, 0, 0];
      }

      const startIndex = getStartIndexForOffset(
        this.props,
        scrollOffset,
        this._instanceProps
      );
      const stopIndex = getStopIndexForStartIndex(
        this.props,
        startIndex,
        scrollOffset,
        this._instanceProps
      );

      // Overscan by one item in each direction so that tab/focus works.
      // If there isn't at least one extra item, tab loops back around.
      const overscanBackward =
        scrollDirection === 'backward' ? Math.max(1, overscanCount) : 1;
      const overscanForward =
        scrollDirection === 'forward' ? Math.max(1, overscanCount) : 1;

      return [
        Math.max(0, startIndex - overscanBackward),
        Math.max(0, Math.min(itemCount - 1, stopIndex + overscanForward)),
        startIndex,
        stopIndex,
      ];
    }

    _onScrollHorizontal = (event: ScrollEvent): void => {
      const target = event.currentTarget;
      const { scrollLeft, scrollRight } = this._getScrollLength(target);
      const { reversed } = this.props;
      const scrollOffset = reversed ? scrollRight : scrollLeft;
      this.setState(prevState => {
        if (prevState.scrollOffset === scrollOffset) {
          // Scroll position may have been updated by cDM/cDU,
          // In which case we don't need to trigger another render,
          // And we don't want to update state.isScrolling.
          return null;
        }

        return {
          isScrolling: true,
          scrollDirection:
            prevState.scrollOffset < scrollOffset ? 'forward' : 'backward',
          scrollOffset,
          scrollUpdateWasRequested: false,
        };
      }, this._resetIsScrollingDebounced);
    };

    _onScrollVertical = (event: ScrollEvent): void => {
      const target = event.currentTarget;
      const { scrollTop, scrollBottom } = this._getScrollLength(target);
      const { reversed } = this.props;
      const scrollOffset = reversed ? scrollBottom : scrollTop;
      this.setState(prevState => {
        if (prevState.scrollOffset === scrollOffset) {
          // Scroll position may have been updated by cDM/cDU,
          // In which case we don't need to trigger another render,
          // And we don't want to update state.isScrolling.
          return null;
        }

        return {
          isScrolling: true,
          scrollDirection:
            prevState.scrollOffset < scrollOffset ? 'forward' : 'backward',
          scrollOffset,
          scrollUpdateWasRequested: false,
        };
      }, this._resetIsScrollingDebounced);
    };

    _outerRefSetter = (ref: any): void => {
      const { outerRef } = this.props;

      this._outerRef = ((ref: any): HTMLDivElement);

      if (typeof outerRef === 'function') {
        outerRef(ref);
      } else if (
        outerRef != null &&
        typeof outerRef === 'object' &&
        outerRef.hasOwnProperty('current')
      ) {
        outerRef.current = ref;
      }
    };

    _resetIsScrollingDebounced = () => {
      if (this._resetIsScrollingTimeoutId !== null) {
        clearTimeout(this._resetIsScrollingTimeoutId);
      }

      this._resetIsScrollingTimeoutId = setTimeout(
        this._resetIsScrolling,
        IS_SCROLLING_DEBOUNCE_INTERVAL
      );
    };

    _resetIsScrolling = () => {
      this._resetIsScrollingTimeoutId = null;

      this.setState({ isScrolling: false }, () => {
        // Clear style cache after state update has been committed.
        // This way we don't break pure sCU for items that don't use isScrolling param.
        this._getItemStyleCache(-1);
      });
    };
  };
}

// NOTE: I considered further wrapping individual items with a pure ListItem component.
// This would avoid ever calling the render function for the same index more than once,
// But it would also add the overhead of a lot of components/fibers.
// I assume people already do this (render function returning a class component),
// So my doing it would just unnecessarily double the wrappers.

const validateSharedProps = ({
  children,
  direction,
  height,
  width,
}: Props<any>): void => {
  if (process.env.NODE_ENV !== 'production') {
    if (direction !== 'horizontal' && direction !== 'vertical') {
      throw Error(
        'An invalid "direction" prop has been specified. ' +
          'Value should be either "horizontal" or "vertical". ' +
          `"${direction}" was specified.`
      );
    }

    if (children == null) {
      throw Error(
        'An invalid "children" prop has been specified. ' +
          'Value should be a React component. ' +
          `"${children === null ? 'null' : typeof children}" was specified.`
      );
    }

    if (direction === 'horizontal' && typeof width !== 'number') {
      throw Error(
        'An invalid "width" prop has been specified. ' +
          'Horizontal lists must specify a number for width. ' +
          `"${width === null ? 'null' : typeof width}" was specified.`
      );
    } else if (direction === 'vertical' && typeof height !== 'number') {
      throw Error(
        'An invalid "height" prop has been specified. ' +
          'Vertical lists must specify a number for height. ' +
          `"${height === null ? 'null' : typeof height}" was specified.`
      );
    }
  }
};
