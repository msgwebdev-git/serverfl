import React from 'react';
import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import path from 'path';

// Path to background image - relative to project root
const backgroundImagePath = path.resolve(process.cwd(), 'src/assets/ticket-bg.jpg');

// Styles
const styles = StyleSheet.create({
  page: {
    position: 'relative',
    width: '100%',
    height: '100%',
  },
  backgroundImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  content: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    paddingTop: 24,
    paddingBottom: 20,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  festivalName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  festivalDate: {
    fontSize: 10,
    color: '#666666',
    marginBottom: 16,
  },
  qrContainer: {
    padding: 8,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    marginBottom: 12,
  },
  qrCode: {
    width: 120,
    height: 120,
  },
  ticketCode: {
    fontSize: 10,
    color: '#888888',
    fontFamily: 'Courier',
    marginBottom: 12,
  },
  divider: {
    width: '80%',
    height: 1,
    backgroundColor: '#e5e5e5',
    marginBottom: 12,
  },
  ticketName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 4,
  },
  optionName: {
    fontSize: 11,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 8,
  },
  customerName: {
    fontSize: 10,
    color: '#888888',
    textAlign: 'center',
  },
  orderInfo: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
  },
  orderInfoItem: {
    alignItems: 'center',
  },
  orderInfoLabel: {
    fontSize: 8,
    color: '#999999',
    textTransform: 'uppercase',
  },
  orderInfoValue: {
    fontSize: 10,
    color: '#333333',
    fontWeight: 'bold',
  },
});

export interface TicketPDFProps {
  orderNumber: string;
  ticketCode: string;
  customerName: string;
  ticketName: string;
  optionName?: string;
  qrDataUrl: string;
  eventDate?: string;
}

export const TicketDocument: React.FC<TicketPDFProps> = ({
  orderNumber,
  ticketCode,
  customerName,
  ticketName,
  optionName,
  qrDataUrl,
  eventDate = '7-9 August 2026',
}) => (
  <Document>
    <Page size={[320, 560]} style={styles.page}>
      {/* Background Image */}
      <Image src={backgroundImagePath} style={styles.backgroundImage} />

      {/* White bottom section */}
      <View style={styles.content}>
        <Text style={styles.festivalName}>Festivalul Lupilor</Text>
        <Text style={styles.festivalDate}>{eventDate}</Text>

        {/* QR Code */}
        <View style={styles.qrContainer}>
          <Image src={qrDataUrl} style={styles.qrCode} />
        </View>

        <Text style={styles.ticketCode}>{ticketCode}</Text>

        <View style={styles.divider} />

        {/* Ticket Info */}
        <Text style={styles.ticketName}>{ticketName}</Text>
        {optionName && <Text style={styles.optionName}>{optionName}</Text>}
        <Text style={styles.customerName}>{customerName}</Text>

        {/* Order Info */}
        <View style={styles.orderInfo}>
          <View style={styles.orderInfoItem}>
            <Text style={styles.orderInfoLabel}>Comanda</Text>
            <Text style={styles.orderInfoValue}>#{orderNumber}</Text>
          </View>
        </View>
      </View>
    </Page>
  </Document>
);

export default TicketDocument;
