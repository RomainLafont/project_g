import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Button,
  Chip,
  Grid,
  Card,
  CardContent
} from '@mui/material';
import axios from 'axios';

interface Quote {
  id: string;
  status: string;
  basePrice: number;
  totalPrice: number;
  adjustedPrice: number;
  pricingFactor: number;
  createdAt: string;
  order: {
    id: string;
    title: string;
    orderNumber: string;
    dentist: {
      firstName: string;
      lastName: string;
      practiceName: string;
    };
    supplier: {
      firstName: string;
      lastName: string;
      companyName: string;
    };
  };
  supplier: {
    firstName: string;
    lastName: string;
    companyName: string;
  };
}

const QuotesManagement: React.FC = () => {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchQuotes();
  }, []);

  const fetchQuotes = async () => {
    try {
      const response = await axios.get('/api/admin/quotes');
      setQuotes(response.data.quotes);
    } catch (error) {
      console.error('Failed to fetch quotes:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: { [key: string]: string } = {
      'draft': 'default',
      'sent': 'info',
      'accepted': 'success',
      'rejected': 'error',
      'modified': 'warning'
    };
    return colors[status] || 'default';
  };

  const filteredQuotes = quotes.filter(quote => {
    return quote.order.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
           quote.order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
           quote.supplier.companyName.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const totalRevenue = quotes
    .filter(quote => quote.status === 'accepted')
    .reduce((sum, quote) => sum + quote.totalPrice, 0);

  const averageMargin = quotes.length > 0 
    ? quotes.reduce((sum, quote) => sum + (quote.adjustedPrice - quote.totalPrice), 0) / quotes.length
    : 0;

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Quotes Management
      </Typography>

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Quotes
              </Typography>
              <Typography variant="h4">
                {quotes.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Accepted Quotes
              </Typography>
              <Typography variant="h4">
                {quotes.filter(q => q.status === 'accepted').length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Revenue
              </Typography>
              <Typography variant="h4">
                €{totalRevenue.toFixed(2)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Avg Margin
              </Typography>
              <Typography variant="h4">
                €{averageMargin.toFixed(2)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Search */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Search quotes"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by order title, number, or supplier"
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <Button
              variant="contained"
              onClick={fetchQuotes}
              fullWidth
            >
              Refresh
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Quotes Table */}
      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Order #</TableCell>
                <TableCell>Order Title</TableCell>
                <TableCell>Supplier</TableCell>
                <TableCell>Original Price</TableCell>
                <TableCell>Adjusted Price</TableCell>
                <TableCell>Margin</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Created</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredQuotes.map((quote) => (
                <TableRow key={quote.id}>
                  <TableCell>{quote.order.orderNumber}</TableCell>
                  <TableCell>{quote.order.title}</TableCell>
                  <TableCell>
                    <Box>
                      <Typography variant="body2">
                        {quote.supplier.firstName} {quote.supplier.lastName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {quote.supplier.companyName}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>€{quote.totalPrice.toFixed(2)}</TableCell>
                  <TableCell>€{quote.adjustedPrice.toFixed(2)}</TableCell>
                  <TableCell>
                    <Typography 
                      color={quote.adjustedPrice > quote.totalPrice ? 'success.main' : 'error.main'}
                    >
                      €{(quote.adjustedPrice - quote.totalPrice).toFixed(2)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      ({(quote.pricingFactor * 100 - 100).toFixed(0)}%)
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={quote.status.toUpperCase()}
                      color={getStatusColor(quote.status) as any}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {new Date(quote.createdAt).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
};

export default QuotesManagement;