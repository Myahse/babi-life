package shop

import "math"

// Operator: a way to pay on GeniusPay's page, and the share it keeps. With the
// update « frais-operateur », the player picks one before paying and its fees
// come on top of the price: the game gets the price whole.
type Operator struct {
	ID    string  `json:"id"` // GeniusPay's payment_method
	Label string  `json:"label"`
	Rate  float64 `json:"rate"` // percent of the price
}

var Operators = []Operator{
	{ID: "wave", Label: "Wave", Rate: 1.5},
	{ID: "orange_money", Label: "Orange Money", Rate: 3.5},
	{ID: "mtn_money", Label: "MTN Money", Rate: 3.5},
	{ID: "moov_money", Label: "Moov Money", Rate: 3.5},
}

func FindOperator(id string) (Operator, bool) {
	for _, o := range Operators {
		if o.ID == id {
			return o, true
		}
	}
	return Operator{}, false
}

// Fee: what the operator keeps on a price, rounded up to the franc.
func (o Operator) Fee(price int) int { return int(math.Ceil(float64(price) * o.Rate / 100)) }
