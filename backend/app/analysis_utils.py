# backend/app/analysis_utils.py
import numpy as np
import pandas as pd
from typing import Union, Any


def _to_scalar(x: Any) -> Union[int, float, str, None]:
    """
    Convert numpy scalar or 0-D array to Python scalar.
    For Series/Index, use mean() to reduce to scalar.
    Pass through native Python scalars.
    """
    if x is None or pd.isna(x):
        return None
    
    # Handle pandas Series/Index
    if isinstance(x, (pd.Series, pd.Index)):
        if len(x) == 0:
            return None
        return _to_scalar(x.mean())
    
    # Handle numpy arrays
    if isinstance(x, np.ndarray):
        if x.size == 0:
            return None
        if x.ndim == 0:  # 0-D array (scalar)
            return x.item()
        elif x.ndim == 1 and x.size == 1:  # 1-D array with single element
            return x.item()
        else:
            # For multi-element arrays, return mean
            return np.nanmean(x).item()
    
    # Handle numpy scalars
    if isinstance(x, (np.integer, np.floating)):
        return x.item()
    
    # Handle native Python types
    if isinstance(x, (int, float, str, bool)):
        return x
    
    # For other types, try to convert to float
    try:
        return float(x)
    except (ValueError, TypeError):
        return None


def safe_quantile(data: Union[np.ndarray, pd.Series], q: float, **kwargs) -> Union[float, None]:
    """Safely compute quantile and return Python scalar."""
    try:
        result = np.nanquantile(data, q, **kwargs)
        return _to_scalar(result)
    except Exception:
        return None


def safe_percentile(data: Union[np.ndarray, pd.Series], p: float, **kwargs) -> Union[float, None]:
    """Safely compute percentile and return Python scalar."""
    try:
        result = np.nanpercentile(data, p, **kwargs)
        return _to_scalar(result)
    except Exception:
        return None


def safe_mean(data: Union[np.ndarray, pd.Series], **kwargs) -> Union[float, None]:
    """Safely compute mean and return Python scalar."""
    try:
        result = np.nanmean(data, **kwargs)
        return _to_scalar(result)
    except Exception:
        return None


def safe_median(data: Union[np.ndarray, pd.Series], **kwargs) -> Union[float, None]:
    """Safely compute median and return Python scalar."""
    try:
        result = np.nanmedian(data, **kwargs)
        return _to_scalar(result)
    except Exception:
        return None


def safe_std(data: Union[np.ndarray, pd.Series], **kwargs) -> Union[float, None]:
    """Safely compute standard deviation and return Python scalar."""
    try:
        result = np.nanstd(data, **kwargs)
        return _to_scalar(result)
    except Exception:
        return None


def safe_sum(data: Union[np.ndarray, pd.Series], **kwargs) -> Union[float, None]:
    """Safely compute sum and return Python scalar."""
    try:
        result = np.nansum(data, **kwargs)
        return _to_scalar(result)
    except Exception:
        return None


def safe_max(data: Union[np.ndarray, pd.Series], **kwargs) -> Union[float, None]:
    """Safely compute maximum and return Python scalar."""
    try:
        result = np.nanmax(data, **kwargs)
        return _to_scalar(result)
    except Exception:
        return None


def safe_min(data: Union[np.ndarray, pd.Series], **kwargs) -> Union[float, None]:
    """Safely compute minimum and return Python scalar."""
    try:
        result = np.nanmin(data, **kwargs)
        return _to_scalar(result)
    except Exception:
        return None
